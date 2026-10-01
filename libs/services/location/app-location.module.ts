import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { LocationPersistenceModule } from "./location.persistence.module";
import { LocationService } from "./location.service";
import { AppLocationResolver } from "./resolver/app-location.resolver";

/**
 * Location module for the rider and driver apps.
 *
 * Self-contained: it wires the persistence layer, the shared
 * `LocationService` and the shared `AppLocationResolver` together with
 * everything `AuthGuard` / `RoleGuard` need (UserPersistenceModule,
 * EnvService), so both apps only have to import this single module and get an
 * identical `locations` / `locationSubLocations` schema.
 */
@Module({
  imports: [LocationPersistenceModule, UserPersistenceModule],
  providers: [LocationService, AppLocationResolver, EnvService],
  exports: [LocationService],
})
export class AppLocationModule {}