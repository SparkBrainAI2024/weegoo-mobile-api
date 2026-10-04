import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MaintenanceInfo, MaintenanceInfoSchema } from "@libs/data-access/entities/maintenance-info.entity";
import { MaintenanceInfoRepository } from "@libs/data-access/repositories/maintenance-info.repository";
import { MaintenanceInfoService } from "./maintenance-info.service";

/**
 * Global so that `MaintenanceInfoService` can be injected anywhere without
 * every feature module having to import this module (it is used by guards).
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MaintenanceInfo.name, schema: MaintenanceInfoSchema },
    ]),
  ],
  providers: [MaintenanceInfoRepository, MaintenanceInfoService],
  exports: [MaintenanceInfoService, MaintenanceInfoRepository, MongooseModule],
})
export class MaintenanceInfoPersistenceModule {}