import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "./user-persistent.module";
import { UserService } from "./user.service";
import { UserDetailsService } from "./user.details.services";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [UserPersistenceModule],
  providers: [UserService, UserDetailsService, EnvService],
  exports: [UserService, UserDetailsService, EnvService],
})
export class UserServiceModule {}