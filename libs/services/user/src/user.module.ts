import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "./user-persistent.module";
import { UserService } from "./user.service";
import { UserDetailsService } from "./user.details.services";
import { EnvService } from "@libs/common/config/env.service";
import { S3Module } from "@libs/s3";

@Module({
  imports: [UserPersistenceModule,S3Module],
  providers: [UserService, UserDetailsService, EnvService],
  exports: [UserService, UserDetailsService, EnvService],
})
export class UserServiceModule {}