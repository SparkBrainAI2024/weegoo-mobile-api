import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { MaintenanceInfo } from "@libs/data-access/entities/maintenance-info.entity";
import { UpsertMaintenanceInfoInput } from "@libs/data-access/dtos/input/upsert-maintenance-info.input";
import { MaintenanceInfoService } from "@libs/services/maintenance-info/maintenance-info.service";

@UseGuards(AdminAuthGuard)
@Resolver(() => MaintenanceInfo)
export class MaintenanceInfoResolver {
  constructor(
    private readonly maintenanceInfoService: MaintenanceInfoService,
  ) {}

  @Query(() => MaintenanceInfo, { name: "maintenanceInfo" })
  async getMaintenanceInfo(): Promise<MaintenanceInfo> {
    return this.maintenanceInfoService.getMaintenanceInfo();
  }

  @Mutation(() => MaintenanceInfo)
  async upsertMaintenanceInfo(
    @Args("input") input: UpsertMaintenanceInfoInput,
  ): Promise<MaintenanceInfo> {
    return this.maintenanceInfoService.upsert(input);
  }
}