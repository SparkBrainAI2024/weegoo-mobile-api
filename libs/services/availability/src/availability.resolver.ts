import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard, RoleGuard } from "@libs/guards";
import { CurrentUser, Roles } from "@libs/common";
import {
  AddAvailabilityInput,
  UpdateAvailabilityInput,
} from "@libs/data-access/dtos/input/availability.input";
import {
  AvailabilityDayDetail,
  ScheduledVehicleSeatCapacity,
} from "@libs/data-access/dtos/response/availability.response";
import { ScheduledVehicleType } from "@libs/data-access/enums/vehicle.enum";
import { VEHICLE_SEAT_CAPACITY } from "@libs/data-access/entities/availability.entity";
import { BasicResponse } from "@libs/data-access/dtos/response/basic.response";
import { Availability, roles, User } from "@libs/data-access";
import { AvailabilityService } from "./availability.service";

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
export class AvailabilityResolver {
  constructor(private readonly availabilityService: AvailabilityService) {}

  @Query(() => [ScheduledVehicleSeatCapacity], {
    name: "scheduledVehicleSeatCapacities",
    description:
      "Returns the maximum seat capacity configured for each scheduled vehicle type (JEEP, MICRO, CAR).",
  })
  scheduledVehicleSeatCapacities(): ScheduledVehicleSeatCapacity[] {
    return (Object.values(ScheduledVehicleType) as ScheduledVehicleType[]).map(
      (vehicleType) => ({
        vehicleType,
        maxSeats: VEHICLE_SEAT_CAPACITY[vehicleType],
      }),
    );
  }

  @Roles(roles.RIDER)
  @Mutation(() => Availability, {
    name: "addAvailability",
    description:
      "Adds the driver's availability for one day. The day must be today up to 6 days from today and must not already exist (duplicate dates are rejected).",
  })
  addAvailability(
    @CurrentUser() user: User,
    @Args("input") input: AddAvailabilityInput,
  ) {
    return this.availabilityService.addWeeklyAvailability(user._id, input);
  }

  @Roles(roles.RIDER)
  @Query(() => AvailabilityDayDetail, {
    name: "getAvailabilityByDate",
    description: "Returns the driver's availability detail for a specific date.",
  })
  getAvailabilityByDate(
    @CurrentUser() user: User,
    @Args("date", { type: () => Date }) date: Date,
  ) {
    return this.availabilityService.getAvailabilityByDate(user._id, date);
  }

  @Roles(roles.RIDER)
  @Query(() => Availability, {
    name: "getAvailabilityWeek",
    nullable: true,
    description:
      "Returns the driver's availability for a whole week starting from Monday (if the week's Sunday has passed, returns from the following Monday).",
  })
  getAvailabilityWeek(
    @CurrentUser() user: User,
    @Args("date", { type: () => Date, nullable: true }) date?: Date,
  ) {
    return this.availabilityService.getAvailabilityWeek(user._id, date);
  }

  @Roles(roles.RIDER)
  @Mutation(() => Availability, {
    name: "updateAvailability",
    description: "Updates the driver's availability info for a specific date.",
  })
  updateAvailability(
    @CurrentUser() user: User,
    @Args("input") input: UpdateAvailabilityInput,
  ) {
    return this.availabilityService.updateAvailability(user._id, input);
  }

  @Roles(roles.RIDER)
  @Mutation(() => BasicResponse, {
    name: "removeAvailability",
    description: "Removes the driver's availability for a specific date.",
  })
  removeAvailability(
    @CurrentUser() user: User,
    @Args("date", { type: () => Date }) date: Date,
  ) {
    return this.availabilityService.removeAvailability(user._id, date);
  }
}