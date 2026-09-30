import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EnvService } from "@libs/common/config/env.service";
import { adminUserModel } from "@libs/data-access/entities/admin-user.entity";
import { AdminUserRepository } from "@libs/data-access/repositories/admin-user.repository";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { LocationPersistenceModule } from "./location.persistence.module";
import { LocationResolver } from "./resolver/location.resolver";
import { LocationService } from "./location.service";

/**
 * Location feature module (admin API).
 *
 * Self-contained: it wires the persistence layer, the service and the admin
 * resolver together with everything `AdminAuthGuard` needs
 * (AdminUserRepository, UserTokenMetaRepository, EnvService), so the app only
 * has to import this single module.
 */
@Module({
  imports: [
    LocationPersistenceModule,
    UserPersistenceModule,
    MongooseModule.forFeature([adminUserModel]),
  ],
  providers: [
    LocationService,
    LocationResolver,
    AdminUserRepository,
    EnvService,
  ],
  exports: [LocationService, LocationPersistenceModule],
})
export class LocationModule {}
