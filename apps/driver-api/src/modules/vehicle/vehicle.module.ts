import { Module } from "@nestjs/common";

import { S3Module } from "@libs/s3/s3.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";
import { VehicleService } from "@libs/services/vehicle/vehicle.service";

@Module({
  imports: [S3Module, CommonVehicleModule],
  providers: [VehicleService],
  exports: [S3Module],
})
export class VehicleModule {}
