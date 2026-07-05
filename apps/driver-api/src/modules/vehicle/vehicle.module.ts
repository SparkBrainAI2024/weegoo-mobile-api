import { Module } from "@nestjs/common";

import { S3Module } from "@libs/s3/s3.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";

@Module({
  imports: [S3Module, CommonVehicleModule],
  providers: [],
  exports: [S3Module],
})
export class VehicleModule {}
