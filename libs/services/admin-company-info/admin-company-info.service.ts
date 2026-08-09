import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common";
import { AdminCompanyInfo } from "@libs/data-access/entities/admin-company-info.entity";
import { AdminCompanyInfoRepository } from "@libs/data-access/repositories/admin-company-info.repository";
import { UpsertAdminCompanyInfoInput } from "@libs/data-access/dtos/input/upsert-admin-company-info.input";

@Injectable()
export class AdminCompanyInfoService {
  constructor(
    private readonly adminCompanyInfoRepository: AdminCompanyInfoRepository,
  ) {}

  async getCompanyInfo(): Promise<AdminCompanyInfo> {
    const companyInfo = await this.adminCompanyInfoRepository.findFirst();
    if (!companyInfo) {
      ErrorException(
        null,
        "ADMIN_COMPANY_INFO.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }
    return companyInfo.toObject() as AdminCompanyInfo;
  }

  async upsert(input: UpsertAdminCompanyInfoInput): Promise<AdminCompanyInfo> {
    const companyInfo = await this.adminCompanyInfoRepository.upsert({
      companyName: input.companyName,
      supportEmail: input.supportEmail,
    });
    return companyInfo.toObject() as AdminCompanyInfo;
  }
}