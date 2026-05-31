// apps/admin/src/auth/admin-auth.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { MailService } from "@libs/services/mail";
import { roles, userVerificationModel } from "@libs/data-access";
import { adminUserModel } from "@libs/data-access/entities/admin-user.entity";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AdminAuthService } from "../auth/admin-auth.service";
import { AdminAuthResolver } from "../auth/resolver/admin-auth.resolver";
import { AdminUserRepository } from "../user/repository/admin-user.repository";

@Module({
  imports: [
    MongooseModule.forFeature([adminUserModel, userVerificationModel,]),
    UserAuthModule.forRoot({defaultRole:roles.ADMIN}),  // Import UserAuthModule to reuse its services and models
    
  ],
  providers: [
    AdminAuthResolver,
    AdminAuthService,
    AdminUserRepository,
    MailService,
  ],
  exports: [AdminAuthService],
})
export class AdminAuthModule {}