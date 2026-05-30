import { CurrentUser } from "@libs/common";
import { User } from "@libs/data-access/entities/user.entity";
import { Rides } from "@libs/data-access";
import { RidesResolver } from "@libs/services/rides/resolver/rides.resolver";
import { Args, Query, Resolver } from "@nestjs/graphql";
import { AuthGuard } from "@libs/guards/guard";
import { UseGuards } from "@nestjs/common";
import { RidesService } from "@libs/services/rides/rides.service";
import { OngoingRideResponse } from "@libs/data-access/dtos/response/ongoing-ride-details.response";


@Resolver(() => Rides)
@UseGuards(AuthGuard)
export class PassengerRidesResolver  {
  constructor(private readonly ridesService: RidesService) { }

@Query(() => OngoingRideResponse)
async getOngoingRide(
  @Args('rideId') rideId: string,
  @CurrentUser() passenger: User,
) {
  return this.ridesService.getOngoingRide(rideId,passenger._id);
}
}

