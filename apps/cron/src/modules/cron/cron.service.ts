import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { MATCHMAKING_CONFIG } from '@libs/common';
import {
  Rides,
  RidesDocument,
  UserDetails,
  UserDetailsDocument,
  UserDailyOnlineStatus,
  UserDailyOnlineStatusDocument,
  User,
  UserDocument,
  Vehicle,
  VehicleDocument,
} from '@libs/data-access';
import { DriverOnlineStatus } from '@libs/data-access/enums/user.enum';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { VehicleService } from '@libs/services/vehicle/vehicle.service';
import { DriverDocumentService } from '@libs/services/driver-document/driver-document.service';
import { AvailabilityService } from '@libs/services/availability/availability.service';
import { S3Service } from '@libs/s3';
import { RideChannelService } from '@libs/services/ably';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';

/**
 * CronService
 *
 * Central scheduler for all background/cron jobs in the platform. This lives in
 * its own dedicated `cron` NestJS application so that scheduled work is fully
 * isolated from the request-serving API apps (ride-matchmaking, driver-api, etc.).
 *
 * Keeping cron jobs in a separate process means:
 *  - API apps no longer need `@nestjs/schedule` / `ScheduleModule` registered.
 *  - Scheduled sweeps cannot block or be blocked by HTTP request handling.
 *  - Each job is independently scalable in deployment.
 *
 * NOTE: This is a separate process from the ride-matchmaking service, so it does
 * NOT hold any in-process Ably driver-location subscriptions. The stale-driver
 * sweep therefore only performs the database-level reconciliation (marking drivers
 * offline + folding online-time into the daily status record). Aborting local Ably
 * subscriptions is a concern of the matchmaking process itself, which already
 * re-subscribes drivers on their next online event.
 */
@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(UserDetails.name)
    private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(UserDailyOnlineStatus.name)
    private readonly userDailyOnlineStatusModel: Model<UserDailyOnlineStatusDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Vehicle.name)
    private readonly vehicleModel: Model<VehicleDocument>,
    private readonly vehicleService: VehicleService,
    private readonly driverDocService: DriverDocumentService,
    private readonly availabilityService: AvailabilityService,
    private readonly s3: S3Service,
    private readonly rideChannelService: RideChannelService,
  ) {}

  // ─── Stale-driver sweep (runs every 5 minutes) ──────────────────────────────────
  // Mirrors the sweep that previously lived on the ride-matchmaking service.
  @Cron(MATCHMAKING_CONFIG.STALE_DRIVER_CHECK_CRON)
  async cleanupStaleOfflineDrivers(): Promise<{
    processed: number;
    markedOffline: number;
    errors: number;
  }> {
    const timeoutMinutes = MATCHMAKING_CONFIG.LOCATION_UPDATE_TIMEOUT_MINUTES;
    const staleThreshold = new Date(
      Date.now() - timeoutMinutes * 60 * 1000,
    );
    this.logger.log(
      `Sweeping stale online drivers (lastLocationUpdateAt before ${staleThreshold.toISOString()})`,
    );

    let processed = 0;
    let markedOffline = 0;
    let errors = 0;

    try {
      // Find ONLINE drivers whose last location update is stale (or was never
      // received). `lastLocationUpdateAt` is seeded when the driver goes online
      // and refreshed on every location update the matchmaking service receives.
      const staleDrivers = await this.userDetailsModel
        .find({
          driverOnlineStatus: DriverOnlineStatus.ONLINE,
          deleted: false,
          $or: [
            { lastLocationUpdateAt: { $exists: false } },
            { lastLocationUpdateAt: { $lte: staleThreshold } },
          ],
        })
        .exec();

      this.logger.log(
        `Found ${staleDrivers.length} online drivers with stale location`,
      );

      for (const driverDetails of staleDrivers) {
        processed++;
        const driverId = driverDetails.userId.toString();
        const driverObjectId = new Types.ObjectId(driverDetails.userId);

        try {
          // Don't force-offline a driver who is in the middle of an active ride —
          // that would disrupt pickup/ongoing-ride logic that relies on the
          // driver remaining online. They will be re-evaluated on the next sweep.
          const activeRide = await this.ridesModel
            .findOne({
              driverId: driverObjectId,
              rideStatus: {
                $in: [
                  RideStatus.CONFIRMED,
                  RideStatus.ONGOING,
                  RideStatus.PICKUP,
                ],
              },
              deleted: false,
            })
            .exec();

          if (activeRide) {
            this.logger.log(
              `Skipping offline-mark for driver ${driverId}: active ride ${activeRide.rideUUId} in progress`,
            );
            continue;
          }

          // Mark the driver offline and clear the location-update timestamp so a
          // fresh window starts the next time they come online.
          await this.userDetailsModel
            .findOneAndUpdate(
              { userId: driverObjectId, deleted: false },
              {
                $set: {
                  driverOnlineStatus: DriverOnlineStatus.OFFLINE,
                  lastLocationUpdateAt: null,
                },
              },
            )
            .exec();

          // Reconcile the daily online-status accounting so the driver's
          // totalOnlineSeconds stays accurate (mirrors the logout flow).
          await this.finalizeDailyOnlineStatus(driverId);

          markedOffline++;
          this.logger.log(
            `Marked driver ${driverId} offline: no location update for ${timeoutMinutes} min`,
          );
        } catch (err: any) {
          errors++;
          this.logger.error(
            `Failed to mark driver ${driverId} offline: ${err?.message || err}`,
          );
        }
      }

      this.logger.log(
        `Stale driver sweep complete: processed=${processed}, markedOffline=${markedOffline}, errors=${errors}`,
      );
    } catch (err: any) {
      this.logger.error(
        `Fatal error during stale driver sweep: ${err?.message || err}`,
      );
    }

    return { processed, markedOffline, errors };
  }

  /**
   * Midnight cleanup of inactive S3 objects (vehicle images + driver documents).
   * Runs daily at 00:00 UTC.
   */
  @Cron('0 0 * * *')
  async handleMidnightCleanup(): Promise<void> {
    this.logger.log('Midnight image cleanup started');

    try {
      await this.vehicleService.deleteInactiveImages();
      this.logger.log('Vehicle inactive images cleaned');
    } catch (e) {
      this.logger.error('Vehicle image cleanup failed', e);
    }

    try {
      await this.driverDocService.deleteInactiveFiles();
      this.logger.log('Driver document inactive files cleaned');
    } catch (e) {
      this.logger.error('Driver document cleanup failed', e);
    }

    this.logger.log('Midnight image cleanup completed');
  }

  /**
   * Midnight cleanup of EXPIRED availability days for every driver.
   * Runs daily at 00:00 UTC, the same slot as the S3 image/document cleanup.
   *
   * Availability days whose calendar date has already passed are pruned from
   * each driver's rolling availability document so they never accumulate.
   * Today's days are kept — only fully elapsed dates are removed.
   */
  @Cron('0 0 * * *')
  async handleExpiredAvailabilityCleanup(): Promise<{
    processed: number;
    documentsCleaned: number;
    removedDays: number;
  }> {
    this.logger.log('Availability past-day cleanup started');

    try {
      const result = await this.availabilityService.deletePastAvailabilityDays();
      this.logger.log(
        `Availability past-day cleanup completed: processed=${result.processed}, documentsCleaned=${result.documentsCleaned}, removedDays=${result.removedDays}`,
      );
      return result;
    } catch (e: any) {
      this.logger.error('Availability past-day cleanup failed', e?.message || e);
      return { processed: 0, documentsCleaned: 0, removedDays: 0 };
    }
  }

  // ─── Expired BOOKING schedule-request cleanup (runs every 30 minutes) ────────
  //
  // SCHEDULED rides with rideStatus BOOKING are unpaid / unaccepted schedule
  // requests. Once their requested day has fully passed they can never be
  // accepted or paid for, so they are HARD-DELETED from the rides collection
  // to keep it clean. Today's requests are kept — only requests whose booking
  // date is strictly before the current UTC day (or, when bookingDate is
  // missing, whose bookingTime has elapsed) are removed.
  @Cron('*/30 * * * *')
  async deleteExpiredBookingScheduleRequests(): Promise<{
    deletedCount: number;
  }> {
    this.logger.log('Expired BOOKING schedule-request cleanup started');

    const now = new Date();
    const startOfTodayUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    try {
      const result = await this.ridesModel
        .deleteMany({
          rideType: RideTypes.SCHEDULED,
          rideStatus: RideStatus.BOOKING,
          $or: [
            { 'schedule.bookingDate': { $lt: startOfTodayUtc } },
            {
              'schedule.bookingDate': null,
              bookingTime: { $lt: now },
            },
            {
              schedule: null,
              bookingTime: { $lt: now },
            },
          ],
        })
        .exec();

      this.logger.log(
        `Expired BOOKING schedule-request cleanup completed: deletedCount=${result.deletedCount}`,
      );
      return { deletedCount: result.deletedCount };
    } catch (e: any) {
      this.logger.error(
        'Expired BOOKING schedule-request cleanup failed',
        e?.message || e,
      );
      return { deletedCount: 0 };
    }
  }

  // ─── Scheduled-ride ONGOING transition (runs every minute) ──────────────────
  //
  // CONFIRMED SCHEDULED rides become ONGOING once the buffer time of the
  // availability-day start time slot they were booked against has elapsed
  // (slot start + pickupBufferTimeMinutes). Each transitioned ride's full
  // details are published on the ride's Ably channel (`ride-details` event).
  @Cron('* * * * *')
  async transitionScheduledRidesToOngoing(): Promise<{
    processed: number;
    transitioned: number;
    published: number;
    errors: number;
  }> {
    let processed = 0;
    let transitioned = 0;
    let published = 0;
    let errors = 0;

    try {
      const now = new Date();

      const rides = await this.ridesModel
        .find({
          rideType: RideTypes.SCHEDULED,
          rideStatus: RideStatus.CONFIRMED,
          deleted: false,
          driverId: { $ne: null },
        })
        .exec();

      for (const ride of rides) {
        processed++;
        try {
          const triggerAt = this.resolveOngoingTriggerTime(ride);
          if (triggerAt === null || now < triggerAt) continue;

          const updated = await this.ridesModel
            .findOneAndUpdate(
              { _id: ride._id, rideStatus: RideStatus.CONFIRMED },
              {
                $set: {
                  rideStatus: RideStatus.ONGOING,
                  rideStartedAt: now,
                },
              },
              { new: true },
            )
            .exec();
          if (!updated) continue; // raced with another worker / status change
          transitioned++;

          // Publish the full ride details on the ride's Ably channel.
          await this.publishOngoingRideDetails(updated);
          published++;
        } catch (err: any) {
          errors++;
          this.logger.warn(
            `Failed to transition scheduled ride ${ride.rideUUId} to ONGOING: ${err?.message || err}`,
          );
        }
      }

      if (processed > 0) {
        this.logger.log(
          `Scheduled-ride ONGOING sweep: processed=${processed}, transitioned=${transitioned}, published=${published}, errors=${errors}`,
        );
      }
      return { processed, transitioned, published, errors };
    } catch (e: any) {
      this.logger.error('Scheduled-ride ONGOING sweep failed', e?.message || e);
      return { processed, transitioned, published, errors: errors + 1 };
    }
  }


  /**
   * Resolve the timestamp at which a scheduled ride should flip to ONGOING:
   * the availability-day start time slot (on the ride's booking date) plus the
   * day's pickup buffer time. Falls back to `bookingDate + buffer` for
   * flexible bookings with no concrete time slots.
   */
  private resolveOngoingTriggerTime(ride: RidesDocument): Date | null {
    const schedule = ride.schedule;
    const bookingDate = schedule?.bookingDate
      ? new Date(schedule.bookingDate)
      : ride.bookingTime
        ? new Date(ride.bookingTime)
        : null;
    if (!bookingDate) return null;

    const bufferMs = (schedule?.pickupBufferTimeMinutes ?? 0) * 60 * 1000;

    // Base date at UTC midnight (bookingDate is stored as UTC start of day).
    const base = new Date(
      Date.UTC(
        bookingDate.getUTCFullYear(),
        bookingDate.getUTCMonth(),
        bookingDate.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );

    const slots =
      schedule?.timeSlots?.map((s) => s.startTime).filter(Boolean) || [];
    if (slots.length === 0) {
      // Flexible / whole-day booking: trigger from the booking date itself.
      return new Date(base.getTime() + bufferMs);
    }

    // Use the earliest slot start on the booking day.
    let earliest: Date | null = null;
    for (const slot of slots) {
      const parts = String(slot).split(':');
      const hh = parseInt(parts[0], 10);
      const mm = parseInt(parts[1] || '0', 10);
      if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
      const slotStart = new Date(base.getTime() + hh * 3600000 + mm * 60000);
      if (!earliest || slotStart < earliest) earliest = slotStart;
    }
    if (!earliest) return new Date(base.getTime() + bufferMs);
    return new Date(earliest.getTime() + bufferMs);
  }

  /**
   * Publish the full ride details of a newly-ONGOING scheduled ride on the
   * ride's Ably channel: driver (image, rating, phone, email,
   * driverLocationChannelId), vehicle (image, model, type, hasAc,
   * numberPlate, color, year, name) and passenger (email, phone, rating,
   * image). Also emits a `ride-status-update` event.
   */
  private async publishOngoingRideDetails(ride: RidesDocument): Promise<void> {
    const driverId = ride.driverId?.toString();
    const passengerId = ride.passengerId?.toString();

    const [driverUser, passengerUser, driverDetails, passengerDetails, vehicle] =
      await Promise.all([
        driverId
          ? this.userModel.findById(new Types.ObjectId(driverId)).exec()
          : Promise.resolve(null),
        passengerId
          ? this.userModel.findById(new Types.ObjectId(passengerId)).exec()
          : Promise.resolve(null),
        driverId
          ? this.userDetailsModel
              .findOne({ userId: new Types.ObjectId(driverId) })
              .exec()
          : Promise.resolve(null),
        passengerId
          ? this.userDetailsModel
              .findOne({ userId: new Types.ObjectId(passengerId) })
              .exec()
          : Promise.resolve(null),
        ride.vehicleId
          ? this.vehicleModel.findById(ride.vehicleId).exec()
          : Promise.resolve(null),
      ]);

    const driverImage = getActiveProfileImageUrl(
      driverDetails?.profileImages,
      (key) => this.s3.getPublicUrl(key),
    );
    const passengerImage = getActiveProfileImageUrl(
      passengerDetails?.profileImages,
      (key) => this.s3.getPublicUrl(key),
    );

    const activeVehicleImage = vehicle?.images?.find(
      (img: any) => img.status === 'ACTIVE',
    );
    const vehicleImage = activeVehicleImage
      ? this.s3.getPublicUrl(activeVehicleImage.s3Key)
      : vehicle?.images?.length
        ? this.s3.getPublicUrl(vehicle.images[0].s3Key)
        : null;

    const driverLocationChannelId =
      RideChannelService.getDriverLocationChannelName(driverId || '');

    const payload = this.buildOngoingRidePayload(ride, {
      driverUser,
      passengerUser,
      driverDetails,
      passengerDetails,
      vehicle,
      driverImage,
      passengerImage,
      vehicleImage,
      driverLocationChannelId,
    });

    await this.rideChannelService.publishRideDetails(
      ride.rideUUId,
      payload as any,
    );
    await this.rideChannelService.publishRideStatusUpdate(ride.rideUUId, {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      status: RideStatus.ONGOING,
      updatedAt: new Date().toISOString(),
    });
    this.logger.log(
      `Published ongoing ride details for scheduled ride ${ride.rideUUId}`,
    );
  }

  /**
   * Build the ride-details payload published when a scheduled ride goes ONGOING.
   */
  private buildOngoingRidePayload(
    ride: RidesDocument,
    ctx: {
      driverUser: UserDocument | null;
      passengerUser: UserDocument | null;
      driverDetails: UserDetailsDocument | null;
      passengerDetails: UserDetailsDocument | null;
      vehicle: VehicleDocument | null;
      driverImage: string | null;
      passengerImage: string | null;
      vehicleImage: string | null;
      driverLocationChannelId: string;
    },
  ): Record<string, any> {
    const rideStartedAt = ride.rideStartedAt || new Date();
    return {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      rideStatus: RideStatus.ONGOING,
      rideStartedAt: rideStartedAt.toISOString(),
      bookingTime: ride.bookingTime
        ? new Date(ride.bookingTime).toISOString()
        : null,
      ablyChannelId:
        ride.ablyChannelId || RideChannelService.getChannelName(ride.rideUUId),
      pickupLocation: ride.pickupLocation
        ? {
            address: ride.pickupLocation.address,
            coordinates: ride.pickupLocation.coordinates,
            city: ride.pickupLocation.city,
          }
        : null,
      dropoffLocation: ride.dropoffLocation
        ? {
            address: ride.dropoffLocation.address,
            coordinates: ride.dropoffLocation.coordinates,
            city: ride.dropoffLocation.city,
          }
        : null,
      distanceInKm: ride.distanceInKm ?? 0,
      estimatedFare: ride.estimatedFare ?? 0,
      estimatedTimeInMinutes: ride.estimatedTimeInMinutes ?? 0,
      noOfPassengers: ride.noOfPassengers ?? 1,
      schedule: ride.schedule
        ? {
            bookingType: ride.schedule.bookingType ?? null,
            bookingDate: ride.schedule.bookingDate
              ? new Date(ride.schedule.bookingDate).toISOString()
              : null,
            day: ride.schedule.day ?? null,
            timeSlots: ride.schedule.timeSlots ?? [],
            pickupBufferTimeMinutes: ride.schedule.pickupBufferTimeMinutes ?? 0,
            vehicleType: ride.schedule.vehicleType ?? null,
          }
        : null,
      driver: {
        driverId: ride.driverId?.toString() ?? null,
        fullName:
          ctx.driverDetails?.fullName || ctx.driverUser?.fullName || 'Driver',
        email: ctx.driverUser?.email ?? null,
        phone: ctx.driverUser?.phone ?? '',
        profileImage: ctx.driverImage,
        rating: ctx.driverDetails?.rating ?? 0,
        driverLocationChannelId: ctx.driverLocationChannelId,
      },
      vehicle: {
        vehicleId: ctx.vehicle?._id?.toString() ?? null,
        name: ctx.vehicle?.name ?? null,
        vehicleModel: ctx.vehicle?.vehicleModel ?? null,
        vehicleType:
          ctx.vehicle?.vehicleType ?? ride.schedule?.vehicleType ?? null,
        hasAc: ctx.vehicle?.isAcType ?? false,
        color: ctx.vehicle?.color ?? null,
        numberPlate: ctx.vehicle?.numberPlate ?? null,
        year: ctx.vehicle?.year ?? null,
        vehicleModelType: ctx.vehicle?.vehicleModelType ?? null,
        image: ctx.vehicleImage,
      },
      passenger: {
        passengerId: ride.passengerId?.toString() ?? null,
        fullName:
          ctx.passengerDetails?.fullName ||
          ctx.passengerUser?.fullName ||
          'Passenger',
        email: ctx.passengerUser?.email ?? null,
        phone: ctx.passengerUser?.phone ?? '',
        profileImage: ctx.passengerImage,
        rating: ctx.passengerDetails?.rating ?? 0,
      },
    };
  }


  /**
   * When a driver is force-marked offline (no location updates), reconcile the
   * daily online-status record: fold the elapsed online time into
   * totalOnlineSeconds and clear lastOnlineAt. Mirrors the logout logic in the
   * api's UserDetailsService.setOnlineStatus.
   */
  private async finalizeDailyOnlineStatus(driverId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const record = await this.userDailyOnlineStatusModel
        .findOne({
          userId: new Types.ObjectId(driverId),
          date: today,
        })
        .exec();

      if (record && record.lastOnlineAt) {
        const elapsedSeconds = Math.floor(
          (Date.now() - record.lastOnlineAt.getTime()) / 1000,
        );
        if (elapsedSeconds > 0) {
          await this.userDailyOnlineStatusModel
            .updateOne(
              { _id: record._id },
              {
                $inc: { totalOnlineSeconds: elapsedSeconds },
                $set: { lastOnlineAt: null },
              },
            )
            .exec();
        } else {
          await this.userDailyOnlineStatusModel
            .updateOne(
              { _id: record._id },
              { $set: { lastOnlineAt: null } },
            )
            .exec();
        }
      }
    } catch (err: any) {
      // Non-fatal: online-time accounting is best-effort.
      this.logger.warn(
        `Failed to reconcile daily online status for driver ${driverId}: ${err?.message || err}`,
      );
    }
  }
}
