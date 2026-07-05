import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ImageCleanupService } from "./image-cleanup.service";
import { VehicleModule } from "../vehicle/vehicle.module";
import { DriverDocumentModule } from "../driver-document/driver-document.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";
import { CommonDriverDocumentModule } from "@libs/services/driver-document/driver-document.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    CommonVehicleModule,
    CommonDriverDocumentModule,
  ],
  providers: [ImageCleanupService],
  exports: [],
})
export class CleanupModule {}
