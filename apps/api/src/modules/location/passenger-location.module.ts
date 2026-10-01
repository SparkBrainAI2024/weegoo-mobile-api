import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { LocationPersistenceModule } from "@libs/services/location/location.persistence.module";
import { LocationService } from "@libs/services/location/location.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { PassengerLocationResolver } from "./passenger-location.resolver";

/**
 * Passenger-facing location module.
 *
 * Exposes the location / sub-location dropdown queries (`locations`,
 * `locationSubLocations`) backed by the same `LocationService` the driver app
 * uses. `UserPersistenceModule` + `EnvService` are required by the
 * `AuthGuard` / `RoleGuard` used by the resolver.
 */
@Module({
  imports: [LocationPersistenceModule, UserPersistenceModule],
  providers: [LocationService, PassengerLocationResolver, EnvService],
  exports: [LocationService],
})
export class PassengerLocationModule {}