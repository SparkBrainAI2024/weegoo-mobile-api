// rides.resolver.ts
import { Args, Query, Resolver } from "@nestjs/graphql";

import { UseGuards } from "@nestjs/common";
import {
  RidesService,
} from "@libs/services/rides/rides.service";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import {
  RideDetailResponse,
  RidesListResponse,
} from "@libs/data-access/dtos/response/rides-list.response";
import { RidesListInput } from "@libs/data-access/dtos/input/rides-list.input";
import { Rides } from "@libs/data-access";
import { AdminDashboardInput } from "@libs/data-access/dtos/input/dashboard.input";
import {
  AdminDashboardResponse,
  DashboardChartResponse,
  DriverStatusCounts,
  PassengerRegistrationChartResponse,
  RideStatusChartResponse,
} from "@libs/data-access/dtos/response/admin-dashboard.response";
import { RideDetailInput } from "@libs/data-access/dtos/input/ride-detail.input";

@Resolver()
export class AdminRidesResolver {
  constructor(
    private readonly ridesService: RidesService,
  ) {}

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

  @UseGuards(AdminAuthGuard)
  @Query(() => DashboardChartResponse, {
    description:
      "Admin-only. Returns the completed-rides dashboard chart — a time-series of completed ride counts, grouped by day or month, for the admin dashboard.",
  })
  async getCompletedRideDashboardChart(
    @Args("input") input: AdminDashboardInput,
  ) {
    return this.ridesService.getCompletedRideDashboardChart(input);
  }

  @Query(() => PassengerRegistrationChartResponse, {
    description:
      "Returns passenger (role USER) registrations, grouped by month, for the admin dashboard chart.",
  })
  async passengerRegistrationChart(): Promise<PassengerRegistrationChartResponse> {
    return this.ridesService.getPassengerRegistrationChart();
  }

  @Query(() => DriverStatusCounts, {
    description:
      "Returns total / online / offline driver counts for all drivers in the system.",
  })
  async driverStatusCounts(): Promise<DriverStatusCounts> {
    return this.ridesService.getDriverStatusCounts();
  }

  @UseGuards(AdminAuthGuard)
  @Query(() => RideStatusChartResponse, {
    description:
      "Admin-only. Returns ride counts by status (ongoing, cancelled, completed) " +
      "for rides whose bookingTime falls within the given date range, suitable for a pie chart.",
  })
  async rideStatusChart(@Args("input") input: AdminDashboardInput) {
    return this.ridesService.getRideStatusChart(input);
  }

  @Query(() => RideDetailResponse)
  async rideDetail(
    @Args("input") input: RideDetailInput,
  ): Promise<RideDetailResponse> {
    return this.ridesService.getRideDetail(input);
  }
}
