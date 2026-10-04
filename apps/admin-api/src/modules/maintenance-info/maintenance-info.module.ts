import { Module } from "@nestjs/common";
import { MaintenanceInfoPersistenceModule } from "@libs/services/maintenance-info/maintenance-info.persistence.module";
import { AdminAuthModule } from "../auth/auth.module";
import { MaintenanceInfoResolver } from "./resolver/maintenance-info.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [
    MaintenanceInfoPersistenceModule,
    AdminAuthModule,
    UserPersistenceModule,
  ],
  providers: [MaintenanceInfoResolver, EnvService],
  // Re-export the persistence module (it owns MaintenanceInfoService); the
  // service is not a provider of this module, so exporting it directly makes
  // Nest throw UnknownExportException.
  exports: [MaintenanceInfoPersistenceModule],
})
export class MaintenanceInfoModule {}