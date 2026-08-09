import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { MaintenanceInfo, MaintenanceInfoSchema } from "@libs/data-access/entities/maintenance-info.entity";
import { MaintenanceInfoRepository } from "@libs/data-access/repositories/maintenance-info.repository";
import { MaintenanceInfoService } from "./maintenance-info.service";

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