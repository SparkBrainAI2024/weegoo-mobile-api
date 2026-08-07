import { Module } from "@nestjs/common";
import { AdminCompanyInfoPersistenceModule } from "@libs/services/admin-company-info/admin-company-info.persistence.module";
import { AdminCompanyInfoService } from "@libs/services/admin-company-info/admin-company-info.service";
import { AdminAuthModule } from "../auth/auth.module";
import { AdminCompanyInfoResolver } from "./resolver/admin-company-info.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [AdminCompanyInfoPersistenceModule, AdminAuthModule,UserPersistenceModule],
  providers: [AdminCompanyInfoService, AdminCompanyInfoResolver,EnvService],
  exports: [AdminCompanyInfoService],
})
export class AdminCompanyInfoModule {}