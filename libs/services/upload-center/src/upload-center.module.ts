import { Module } from "@nestjs/common";
import { S3Module } from "@libs/s3";
import { UploadCenterService } from "./upload-center.service";
import { UploadCenterResolver } from "./resolver/upload-center.resolver";
import { UserServiceModule } from "@libs/services/user/user.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

@Module({
  imports:   [S3Module, UserServiceModule, UserPersistenceModule],
  providers: [UploadCenterService, UploadCenterResolver],
  exports:   [UploadCenterService, S3Module],
})
export class UploadCenterModule {}