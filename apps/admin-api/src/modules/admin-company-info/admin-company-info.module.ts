import { Module } from "@nestjs/common";
import { AdminCompanyInfoPersistenceModule } from "@libs/services/admin-company-info/admin-company-info.persistence.module";
import { AdminCompanyInfoService } from "@libs/services/admin-company-info/admin-company-info.service";
import { AdminAuthModule } from "../auth/auth.module";
import { AdminCompanyInfoResolver } from "./resolver/admin-company-info.resolver";

@Module({
  imports: [AdminCompanyInfoPersistenceModule, AdminAuthModule],
  providers: [AdminCompanyInfoService, AdminCompanyInfoResolver],
  exports: [AdminCompanyInfoService],
})
export class AdminCompanyInfoModule {}