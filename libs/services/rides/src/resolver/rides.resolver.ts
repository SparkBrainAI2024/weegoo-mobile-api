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
    let driverId: Types.ObjectId;
    let passengerId: Types.ObjectId;
    let vehicleId: Types.ObjectId;
    let adminId: Types.ObjectId;
    if (process.env.NODE_ENV == "local") {
      driverId = new Types.ObjectId('6a0db9aae2c204483832ccb4');

      passengerId = new Types.ObjectId('6a0db5b3d4abf61482b57da0');
      
      vehicleId = new Types.ObjectId('6a09b0406ae11c2b6255d8e8');
      adminId = new Types.ObjectId('6a0cda16e7cca165f7b0f912');
    }
    else {
      driverId = new Types.ObjectId('6a0767fd9c24957e2fd4cfa6');

      passengerId = new Types.ObjectId('6a0cda16e7cca165f7b0f912');

      vehicleId = new Types.ObjectId('6a09b0406ae11c2b6255d8e8');
      adminId = new Types.ObjectId('6a0cda16e7cca165f7b0f912');
    }
    return this.ridesService.generateSampleRides(
      driverId,
      passengerId,
      vehicleId,
      adminId
    );
  }

  async cancelRide(@Args('rideId') rideId: string) {
    return this.ridesService.cancelRide(rideId);
  }
}
