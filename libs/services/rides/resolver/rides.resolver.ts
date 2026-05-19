import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { Rides, RideStatus, SortBy } from '@libs/data-access';
import { RidesService } from '../rides.service';
import { CurrentUser } from '@libs/common';

@Resolver(() => Rides)
@UseGuards(AuthGuard)
export class RidesResolver {
  constructor(private readonly ridesService: RidesService) { }

  @Query(() => [Rides])

  async getAllRides(
    @CurrentUser() driver: any,
  ) {
    return this.ridesService.findRides(
      driver,
      {
        page: 1, limit: 10, order: SortBy.asc, orderBy: 'orderStartTime', filter: {
          rideStatus: RideStatus.ONGOING
        }
      },
    );
  }
}