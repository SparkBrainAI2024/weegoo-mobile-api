import {
  Rides,
  RidesSchema,
  RidesRepository,
  User,
  Vehicle,
  VehicleSchema,
  UserSchema,
  PromoCode,
  PromoCodeSchema,
  PromoCodeUsed,
  PromoCodeUsedSchema,
  DriverDocument,
  DriverDocumentSchema,
  DriverDocumentRepository,
  VehicleRepository,
  RatingSchema,
  Rating,
  Availability,
  AvailabilitySchema,
  AvailabilityRepository,
} from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rides.name, schema: RidesSchema },
      { name: User.name, schema: UserSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: PromoCodeUsed.name, schema: PromoCodeUsedSchema },
      { name: DriverDocument.name, schema: DriverDocumentSchema },
      { name: Rating.name, schema: RatingSchema },
      { name: Availability.name, schema: AvailabilitySchema },
    ]),
  ],
  providers: [RidesRepository, DriverDocumentRepository, VehicleRepository, AvailabilityRepository],
  exports: [
    RidesRepository,
    DriverDocumentRepository,
    VehicleRepository,
    AvailabilityRepository,
    MongooseModule,
  ],
})
export class RidePersistentModule {}
