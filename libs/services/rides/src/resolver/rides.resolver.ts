import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { PaginationInput, Rides, User } from '@libs/data-access';
import { RidesService } from '../rides.service';
import { CurrentUser } from '@libs/common';

@Resolver(() => Rides)
@UseGuards(AuthGuard)
export class RidesResolver {
  constructor(private readonly ridesService: RidesService) { }

  @Query(() => [Rides])

  async getAllRides(
    @CurrentUser() driver: User,
    @Args('input') input: PaginationInput,
  ) {
    return this.ridesService.findRides(
      driver,
      input
    );
  }
}