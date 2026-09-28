import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Location,
  LocationSchema,
} from "@libs/data-access/entities/location.entity";
import { LocationRepository } from "@libs/data-access/repositories/location.repository";

/**
 * Persistence module for the Location entity.
 * Import it in any app module that needs to read/write locations.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Location.name, schema: LocationSchema },
    ]),
  ],
  providers: [LocationRepository],
  exports: [LocationRepository, MongooseModule],
})
export class LocationPersistenceModule {}
