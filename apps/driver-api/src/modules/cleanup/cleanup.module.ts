import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { ImageCleanupService } from "./image-cleanup.service";
import { VehicleModule } from "../vehicle/vehicle.module";
import { DriverDocumentModule } from "../driver-document/driver-document.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    VehicleModule,
    DriverDocumentModule,
  ],
  providers: [ImageCleanupService],
})
export class CleanupModule {}