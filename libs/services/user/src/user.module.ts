import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "./user-persistent.module";
import { UserService } from "./user.service";
import { UserDetailsService } from "./user.details.services";

@Module({
  imports: [UserPersistenceModule],
  providers: [UserService,UserDetailsService],
  exports: [UserService,UserDetailsService],
})
export class UserServiceModule {}