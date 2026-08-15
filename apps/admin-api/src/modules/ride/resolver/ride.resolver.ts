// rides.resolver.ts
import { Args, Query, Resolver } from "@nestjs/graphql";

import { UseGuards } from "@nestjs/common";
import { RidesService } from "@libs/services/rides/rides.service";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { RidesListResponse } from "@libs/data-access/dtos/response/rides-list.response";
import { RidesListInput } from "@libs/data-access/dtos/input/rides-list.input";
import { Rides } from "@libs/data-access";
import { AdminDashboardInput } from "@libs/data-access/dtos/input/dashboard.input";
import { AdminDashboardResponse } from "@libs/data-access/dtos/response/admin-dashboard.response";

@Resolver()
export class AdminRidesResolver {
  constructor(private readonly ridesService: RidesService) {}

  @UseGuards(AdminAuthGuard)
  @Query(() => RidesListResponse)
  async rides(@Args("input") input: RidesListInput) {
    return this.ridesService.getRidesList(input);
  }

  @Query(() => Rides, { nullable: true })
  async ride(@Args("id") id: string) {
    return this.ridesService.getRideByIdAdmin(id);
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => AdminDashboardResponse)
  async adminDashboard(@Args("input") input: AdminDashboardInput) {
    return this.ridesService.getAdminDashboard(input);
  }
}