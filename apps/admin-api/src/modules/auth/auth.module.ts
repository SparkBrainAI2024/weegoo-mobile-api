// apps/admin/src/auth/admin-auth.module.ts
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

import { MailService } from "@libs/services/mail";
import { roles, userVerificationModel } from "@libs/data-access";
import { adminUserModel } from "@libs/data-access/entities/admin-user.entity";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { AdminAuthResolver } from "../auth/resolver/admin-auth.resolver";
import { AdminUserRepository } from "../../../../../libs/data-access/repositories/admin-user.repository";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { AdminAuthService } from "@libs/services/admin-auth";

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
    AdminAuthGuard
  ],
  exports: [AdminAuthService, AdminAuthGuard],
})
export class AdminAuthModule {}