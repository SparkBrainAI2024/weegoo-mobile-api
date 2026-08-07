import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminCompanyInfo, AdminCompanyInfoSchema } from "@libs/data-access/entities/admin-company-info.entity";
import { AdminCompanyInfoRepository } from "@libs/data-access/repositories/admin-company-info.repository";
import { AdminCompanyInfoService } from "./admin-company-info.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminCompanyInfo.name, schema: AdminCompanyInfoSchema },
    ]),
  ],
  providers: [AdminCompanyInfoRepository, AdminCompanyInfoService],
  exports: [AdminCompanyInfoService, AdminCompanyInfoRepository, MongooseModule],
})
export class AdminCompanyInfoPersistenceModule {}