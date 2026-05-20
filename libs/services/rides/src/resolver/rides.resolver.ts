import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { PaginationInput, Rides, User, RidesDocument } from '@libs/data-access';
import { RidesService } from '../rides.service';
import { CurrentUser } from '@libs/common';
import { RideListWithPaginationResponse } from '@libs/data-access/dtos/response/ride-list-with-pagination.response';
import { Types } from 'mongoose';

@Resolver(() => Rides)
@UseGuards(AuthGuard)
export class RidesResolver {
  constructor(private readonly ridesService: RidesService) { }

  @Query(() => RideListWithPaginationResponse)
  async getAllRides(
    @CurrentUser() driver: User,
    @Args('input') input: PaginationInput,
  ) {
    return this.ridesService.findRides(
      driver,
      input
    );
  }

  @Mutation(() => [Rides])
  async generateSampleRides() {
    const driverId = new Types.ObjectId('6a0db9aae2c204483832ccb4');
    const riderId = new Types.ObjectId('6a0db5b3d4abf61482b57da0');
    const vehicleId = new Types.ObjectId('6a09b0406ae11c2b6255d8e8');

    return this.ridesService.generateSampleRides(
      driverId,
      riderId,
      vehicleId
    );
  }
}
