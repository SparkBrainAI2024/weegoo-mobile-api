import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard } from "@libs/guards";
import {
  PaginationInput,
  Rides,
  User,
  RidesDocument,
  PromoCode,
  CreatePromoCodeInput,
  DashboardHomeResponse,
  GetAllRidesPaginationInput,
} from "@libs/data-access";
import { RidesService } from "../rides.service";
import { CurrentUser } from "@libs/common";
import { RidesListWithCursorPaginationResponse } from "@libs/data-access/dtos/response/rides-list-with-cursor-pagination.response";
import { Types } from "mongoose";
import { CancelRideInput } from "@libs/data-access/dtos/input/cancel-ride.input";
import { CancelRideResponse } from "@libs/data-access/dtos/response/cancel-ride.response";
import { GetRideByIdInput } from "@libs/data-access/dtos/input/get-ride-by-id.input";

@Resolver(() => Rides)
@UseGuards(AuthGuard)
export class RidesResolver {
  constructor(private readonly ridesService: RidesService) {}

  @Query(() => RidesListWithCursorPaginationResponse)
  async getAllRides(
    @CurrentUser() driver: User,
    @Args("input") input: GetAllRidesPaginationInput,
  ) {
    return this.ridesService.findRides(driver, input);
  }

  @Query(() => DashboardHomeResponse)
  async dashboardHomeApi(@CurrentUser() driver: User) {
    return this.ridesService.homeDashboardApi(driver);
  }

  @Query(() => Rides, { name: "getRideById" })
  async getRideById(
    @CurrentUser() user: User,
    @Args("input") input: GetRideByIdInput,
  ) {
    return this.ridesService.getRideById(input.rideId, user);
  }

  @Mutation(() => CancelRideResponse)
  async cancelRide(
    @CurrentUser() user: User,
    @Args("input") input: CancelRideInput,
  ) {
    return this.ridesService.cancelRide(user, input);
  }

  @Mutation(() => PromoCode, {
    name: "createPromoCode",
    description: "Creates a new promo code",
  })
  async createPromoCode(
    @Args("input") input: CreatePromoCodeInput,
  ): Promise<PromoCode> {
    return this.ridesService.createPromoCode(input);
  }
}
