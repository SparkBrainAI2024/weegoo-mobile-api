import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { MATCHMAKING_CONFIG, nepalSlotToInstant } from '@libs/common';
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
  PromoCode,
  PromoCodeDocument,
  PromoCodeStatusEnum,
} from '@libs/data-access';
import { DriverOnlineStatus } from '@libs/data-access/enums/user.enum';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { VehicleService } from '@libs/services/vehicle/vehicle.service';
import { DriverDocumentService } from '@libs/services/driver-document/driver-document.service';
import { AvailabilityService } from '@libs/services/availability/availability.service';
import { S3Service } from '@libs/s3';
import { RideChannelService } from '@libs/services/ably';
import { EnvService } from '@libs/common/config/env.service';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';
import axios from 'axios';

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
    @InjectModel(PromoCode.name)
    private readonly promoCodeModel: Model<PromoCodeDocument>,
    private readonly vehicleService: VehicleService,
    private readonly driverDocService: DriverDocumentService,
    private readonly availabilityService: AvailabilityService,
    private readonly s3: S3Service,
    private readonly rideChannelService: RideChannelService,
    private readonly envService: EnvService,
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

  /**
   * Midnight sweep that deactivates promo codes whose expiry date/time has
   * passed. Runs daily at 00:00 UTC, the same slot as the other midnight jobs.
   *
   * Only promos that are currently ACTIVE are transitioned — DRAFT promos were
   * never published, and promos already INACTIVE/EXPIRED must be left untouched.
   * A promo is deactivated only once its exact `expiryDateTime` has passed
   * (`expiryDateTime < now`), so anything still within its expiry moment is kept.
   */
  @Cron('0 0 * * *')
  async handleExpiredPromoCodeDeactivation(): Promise<{
    processed: number;
    deactivated: number;
  }> {
    const now = new Date();
    this.logger.log(
      `Promo code expiry sweep started (expiryDateTime before ${now.toISOString()})`,
    );

    try {
      const result = await this.promoCodeModel
        .updateMany(
          {
            status: PromoCodeStatusEnum.ACTIVE,
            expiryDateTime: { $lt: now },
            deleted: { $ne: true },
          },
          { $set: { status: PromoCodeStatusEnum.INACTIVE } },
        )
        .exec();

      const processed = result.matchedCount ?? 0;
      const deactivated = result.modifiedCount ?? 0;

      this.logger.log(
        `Promo code expiry sweep completed: matched=${processed}, deactivated=${deactivated}`,
      );
      return { processed, deactivated };
    } catch (e: any) {
      this.logger.error('Promo code expiry sweep failed', e?.message || e);
      return { processed: 0, deactivated: 0 };
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
  // CONFIRMED SCHEDULED rides become ONGOING exactly when the current time has
  // reached (crossed or equals) the ride's start time — the availability-day
  // start-time slot the passenger booked, with no pickup-buffer offset added.
  // Each transitioned ride's details are published on the ride's Ably channel
  // (`ride-details` event).
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

          // Delegate the whole ONGOING transition to the ride-matchmaking
          // service. That process owns the Ably connection, so it performs the
          // CONFIRMED→ONGOING DB update, publishes the ride details/status on
          // the Ably channel, AND subscribes the driver's personal location
          // channel for live tracking — atomically. The cron process is not
          // connected to Ably, so it must not publish or subscribe here (that
          // is what caused the earlier "Ably not initialized" / AggregateError
          // warnings during the scheduled-ride sweep).
          const didTransition =
            await this.notifyMatchmakingScheduledRideOngoing(
              ride._id.toString(),
            );
          if (didTransition) {
            transitioned++;
            continue;
          }

          // Fallback: the matchmaking HTTP call can fail (wrong URL, service
          // down, GraphQL prefix mismatch). Never leave a ride stuck in
          // CONFIRMED after its start slot has crossed — flip the DB status
          // directly here and publish best-effort (publish is a no-op when
          // Ably is not configured in the cron process).
          const fallback = await this.ridesModel
            .findOneAndUpdate(
              {
                _id: ride._id,
                rideStatus: RideStatus.CONFIRMED,
                deleted: false,
              },
              {
                $set: {
                  rideStatus: RideStatus.ONGOING,
                  rideStartedAt: new Date(),
                },
              },
              { new: true },
            )
            .exec();
          if (fallback) {
            transitioned++;
            try {
              await this.publishOngoingRideDetails(fallback);
              published++;
            } catch (publishErr: any) {
              this.logger.warn(
                `Fallback ONGOING publish failed for ride ${ride.rideUUId}: ${publishErr?.message || publishErr}`,
              );
            }
          }
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
   * Ask the ride-matchmaking service to transition a CONFIRMED scheduled ride
   * to ONGOING. The matchmaking process owns the Ably connection, so it does
   * the DB update, publishes the ride details + status, and subscribes the
   * driver's personal location channel — all in one call. The cron process is
   * not connected to Ably, so it must NOT publish/subscribe here itself.
   *
   * NOTE: the ride-matchmaking app registers `app.setGlobalPrefix("driver-api")`
   * (see apps/ride-matchmaking/src/main.ts), so its GraphQL endpoint is served
   * under the prefix (`/driver-api/graphql`), NOT bare `/graphql`. Every other
   * caller in the repo posts to `${matchmakingUrl}/graphql`, which 404s when
   * the prefix is enabled. We therefore try both paths here.
   *
   * Returns true only if the ride-matchmaking service actually transitioned
   * the ride (i.e. it was CONFIRMED). Best-effort: failures are logged as
   * warnings and never fail the sweep (the caller falls back to a direct DB
   * update).
   */
  private async notifyMatchmakingScheduledRideOngoing(
    rideId: string,
  ): Promise<boolean> {
    const rawUrl = this.envService.getString(
      'RIDE_MATCHMAKING_URL',
      'http://localhost:3004',
    );
    const matchmakingUrl = String(rawUrl || '').replace(/\/+$/, '');
    const mutation = `mutation MarkScheduledRideOngoing($rideId: String!) { markScheduledRideOngoing(rideId: $rideId) { success message } }`;

    const candidateUrls = [
      `${matchmakingUrl}/driver-api/graphql`,
      `${matchmakingUrl}/graphql`,
    ];
    for (const url of candidateUrls) {
      try {
        const response = await axios.post(
          url,
          { query: mutation, variables: { rideId } },
          { timeout: 10000 },
        );
        const errors = response.data?.errors;
        if (errors?.length) {
          this.logger.warn(
            `markScheduledRideOngoing for ride ${rideId} via ${url} returned GraphQL errors: ${JSON.stringify(errors).slice(0, 300)}`,
          );
          continue;
        }
        const ok =
          response.data?.data?.markScheduledRideOngoing?.success === true;
        this.logger.log(
          `markScheduledRideOngoing for ride ${rideId}: ${
            response.data?.data?.markScheduledRideOngoing?.message ||
            (ok ? 'OK' : 'not transitioned (already ONGOING or missing)')
          }`,
        );
        if (ok) return true;
        // Definitive "not CONFIRMED" answer — no point trying the other path.
        return false;
      } catch (error: any) {
        this.logger.warn(
          `Failed to mark scheduled ride ${rideId} ONGOING via ${url}: ${error?.message || error}`,
        );
      }
    }
    return false;
  }

  /**
   * Resolve the timestamp at which a scheduled ride should flip to ONGOING.
   * This is the ride's start time — the availability-day start-time slot the
   * passenger booked (on the ride's booking date). The transition is scheduled
   * EXACTLY at that start time (no pickup-buffer offset added), so the sweep
   * flips it the moment the current time crosses or equals it.
   *
   * TIMEZONE: availability slot `startTime`s are stored using NEPAL wall-clock
   * semantics (naive "2026-09-19T10:00:00.000" means 10:00 in Kathmandu, and
   * legacy "HH:mm" means that wall time on the booking day). The old code fed
   * these into `parseSlotStartTime`, which does `new Date(naiveIso)` (parsed as
   * UTC) and `setUTCHours` — i.e. it treated Nepal wall time as UTC and pushed
   * every trigger ~5h45 into the future, so rides stayed CONFIRMED long after
   * their slot had crossed. Every stored slot is now resolved through the shared
   * `nepalSlotToInstant` helper, which returns the REAL instant to compare with
   * `now`.
   *
   * Falls back to the concrete booking time for flexible bookings with no
   * time slots.
   */
  private resolveOngoingTriggerTime(ride: RidesDocument): Date | null {
    const schedule = ride.schedule;

    const slots =
      schedule?.timeSlots?.map((s) => s.startTime).filter(Boolean) || [];
    if (slots.length === 0) {
      // Flexible / whole-day booking: no concrete slot to anchor to — use the
      // actual booking time as the ride's start time.
      if (ride.bookingTime) return new Date(ride.bookingTime);
      if (schedule?.bookingDate) return new Date(schedule.bookingDate);
      return null;
    }

    // Concrete booking instant. Legacy "HH:mm" slots are anchored to this
    // instant's NEPAL calendar day — a booking made late-evening UTC lands on
    // the NEXT Nepal day, so the day must be derived from the instant rather
    // than from the UTC-midnight `bookingDate` anchor.
    const bookingInstant = schedule?.bookingTime
      ? new Date(schedule.bookingTime)
      : ride.bookingTime
        ? new Date(ride.bookingTime)
        : schedule?.bookingDate
          ? new Date(schedule.bookingDate)
          : null;
    const hasValidBookingInstant =
      !!bookingInstant && !isNaN(bookingInstant.getTime());

    // Use the exact booked start time. Since the schedule stores only the booked
    // slot, the single parsed start time IS the ride's start time (the "earliest"
    // guard simply handles any defensive duplicates). Absolute-timestamp slots
    // still resolve when no booking instant is available.
    let start: Date | null = null;
    for (const slot of slots) {
      const slotStart = nepalSlotToInstant(
        String(slot),
        hasValidBookingInstant ? bookingInstant : null,
      );
      if (!slotStart) continue;
      if (!start || slotStart < start) start = slotStart;
    }
    if (start) return start;

    return hasValidBookingInstant ? bookingInstant : null;
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

    const [
      driverUser,
      passengerUser,
      driverDetails,
      passengerDetails,
      vehicle,
    ] = await Promise.all([
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
      (key) => this.s3.getPublicBucketUrl(key),
    );
    const passengerImage = getActiveProfileImageUrl(
      passengerDetails?.profileImages,
      (key) => this.s3.getPublicBucketUrl(key),
    );

    const activeVehicleImage = vehicle?.images?.find(
      (img: any) => img.status === 'ACTIVE',
    );
    const vehicleImage = activeVehicleImage
      ? this.s3.getPublicBucketUrl(activeVehicleImage.s3Key)
      : vehicle?.images?.length
        ? this.s3.getPublicBucketUrl(vehicle.images[0].s3Key)
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
