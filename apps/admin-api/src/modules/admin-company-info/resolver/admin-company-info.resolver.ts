import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { AdminCompanyInfo } from "@libs/data-access/entities/admin-company-info.entity";
import { UpsertAdminCompanyInfoInput } from "@libs/data-access/dtos/input/upsert-admin-company-info.input";
import { AdminCompanyInfoService } from "@libs/services/admin-company-info/admin-company-info.service";

@UseGuards(AdminAuthGuard)
@Resolver(() => AdminCompanyInfo)
export class AdminCompanyInfoResolver {
  constructor(
    private readonly adminCompanyInfoService: AdminCompanyInfoService,
  ) {}

  @Query(() => AdminCompanyInfo, { name: "adminCompanyInfo" })
  async getAdminCompanyInfo(): Promise<AdminCompanyInfo> {
    return this.adminCompanyInfoService.getCompanyInfo();
  }

  @Mutation(() => AdminCompanyInfo)
  async upsertAdminCompanyInfo(
    @Args("input") input: UpsertAdminCompanyInfoInput,
  ): Promise<AdminCompanyInfo> {
    return this.adminCompanyInfoService.upsert(input);
  }
}