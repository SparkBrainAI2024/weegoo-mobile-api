import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { S3Module } from '@libs/s3';
import {
  Rides,
  RidesSchema,
  UserDetails,
  UserDetailsSchema,
  UserDailyOnlineStatus,
  UserDailyOnlineStatusSchema,
  Vehicle,
  VehicleSchema,
  DriverDocument,
  DriverDocumentSchema,
  VehicleRepository,
  DriverDocumentRepository,
  Availability,
  AvailabilitySchema,
  AvailabilityRepository,
} from '@libs/data-access';
import { EnvService } from '@libs/common/config/env.service';
import { VehicleService } from '@libs/services/vehicle/vehicle.service';
import { DriverDocumentService } from '@libs/services/driver-document/driver-document.service';
import { AvailabilityService } from '@libs/services/availability/availability.service';
import { CronService } from './cron.service';
import { HealthController } from './health.controller';

/**
 * CronModule
 *
 * Self-contained feature module for the `cron` application. It registers every
 * Mongoose schema that the cron jobs touch and wires up the shared service
 * instances they depend on (vehicle image cleanup + driver-document cleanup both
 * delegate to the existing shared service classes, avoiding logic duplication).
 *
 * Schemas registered here:
 *  - Rides, UserDetails, UserDailyOnlineStatus  -> stale-driver sweep
 *  - Vehicle, DriverDocument                  -> midnight image/document cleanup
 *  - Availability                           -> midnight past-day cleanup
 */
@Module({
  imports: [
    S3Module,
    MongooseModule.forFeature([
      { name: Rides.name, schema: RidesSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
      { name: UserDailyOnlineStatus.name, schema: UserDailyOnlineStatusSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: DriverDocument.name, schema: DriverDocumentSchema },
      { name: Availability.name, schema: AvailabilitySchema },
    ]),
  ],
  providers: [
    EnvService,
    VehicleRepository,
    VehicleService,
    DriverDocumentRepository,
    DriverDocumentService,
    AvailabilityRepository,
    AvailabilityService,
    CronService,
  ],
  controllers: [HealthController],
})
export class CronModule {}
