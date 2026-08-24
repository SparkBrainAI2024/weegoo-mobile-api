import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Availability,
  AvailabilitySchema,
  AvailabilityRepository,
  VehicleRepository,
} from "@libs/data-access";
import { Vehicle, VehicleSchema } from "@libs/data-access/entities/vehicle.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Availability.name, schema: AvailabilitySchema },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
  ],
  providers: [AvailabilityRepository, VehicleRepository],
  exports: [AvailabilityRepository, VehicleRepository, MongooseModule],
})
export class AvailabilityPersistentModule {}