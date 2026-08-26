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
} from '@libs/data-access';
import { DriverOnlineStatus } from '@libs/data-access/enums/user.enum';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { VehicleService } from '@libs/services/vehicle/vehicle.service';
import { DriverDocumentService } from '@libs/services/driver-document/driver-document.service';
import { AvailabilityService } from '@libs/services/availability/availability.service';

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
    private readonly vehicleService: VehicleService,
    private readonly driverDocService: DriverDocumentService,
    private readonly availabilityService: AvailabilityService,
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
