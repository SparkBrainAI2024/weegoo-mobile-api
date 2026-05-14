import { Module } from "@nestjs/common";
import { S3Module } from "@libs/s3";
import { UploadCenterService } from "./upload-center.service";

@Module({
  imports:   [S3Module],
  providers: [UploadCenterService],
  exports:   [UploadCenterService, S3Module],
})
export class UploadCenterModule {}