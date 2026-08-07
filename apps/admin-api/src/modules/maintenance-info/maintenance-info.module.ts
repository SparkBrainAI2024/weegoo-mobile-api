import { Module } from "@nestjs/common";
import { MaintenanceInfoPersistenceModule } from "@libs/services/maintenance-info/maintenance-info.persistence.module";
import { MaintenanceInfoService } from "@libs/services/maintenance-info/maintenance-info.service";
import { AdminAuthModule } from "../auth/auth.module";
import { MaintenanceInfoResolver } from "./resolver/maintenance-info.resolver";

@Module({
  imports: [MaintenanceInfoPersistenceModule, AdminAuthModule],
  providers: [MaintenanceInfoService, MaintenanceInfoResolver],
  exports: [MaintenanceInfoService],
})
export class MaintenanceInfoModule {}