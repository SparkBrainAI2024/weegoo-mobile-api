import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Availability,
  AvailabilitySchema,
  AvailabilityRepository,
} from "@libs/data-access";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Availability.name, schema: AvailabilitySchema },
    ]),
  ],
  providers: [AvailabilityRepository],
  exports: [AvailabilityRepository, MongooseModule],
})
export class AvailabilityPersistentModule {}