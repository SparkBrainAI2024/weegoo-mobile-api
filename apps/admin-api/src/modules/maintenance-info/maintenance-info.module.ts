import { Module } from "@nestjs/common";
import { MaintenanceInfoPersistenceModule } from "@libs/services/maintenance-info/maintenance-info.persistence.module";
import { MaintenanceInfoService } from "@libs/services/maintenance-info/maintenance-info.service";
import { AdminAuthModule } from "../auth/auth.module";
import { MaintenanceInfoResolver } from "./resolver/maintenance-info.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [MaintenanceInfoPersistenceModule, AdminAuthModule,UserPersistenceModule],
  providers: [MaintenanceInfoService, MaintenanceInfoResolver,EnvService],
  exports: [MaintenanceInfoService],
})
export class MaintenanceInfoModule {}