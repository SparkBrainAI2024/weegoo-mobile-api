import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { LocationPersistenceModule } from "@libs/services/location/location.persistence.module";
import { LocationService } from "@libs/services/location/location.service";
import { DriverLocationResolver } from "@libs/services/location/resolver/driver-location.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

/**
 * Driver-facing location module.
 *
 * Exposes the location / sub-location dropdown queries (`driverLocations`,
 * `driverLocationSubLocations`). `UserPersistenceModule` + `EnvService` are
 * required by the `AuthGuard` / `RoleGuard` used by the resolver.
 */
@Module({
  imports: [LocationPersistenceModule, UserPersistenceModule],
  providers: [LocationService, DriverLocationResolver, EnvService],
  exports: [LocationService],
})
export class DriverLocationModule {}
