// apps/admin/src/auth/admin-auth.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { MailService } from "@libs/services/mail";
import { userVerificationModel } from "@libs/data-access";
import { adminUserModel } from "@libs/data-access/entities/admin-user.entity";
import { AdminAuthResolver } from "./resolver/user.resolver";
import { UserAuthModule } from "@libs/services/auth/auth.module";

@Module({
  imports: [
    MongooseModule.forFeature([adminUserModel, userVerificationModel,]),
    UserAuthModule
  ],
  providers: [
    AdminAuthResolver,
    AdminAuthService,
    AdminUserRepository,
    MailService,
  ],
})
export class AdminAuthModule {}