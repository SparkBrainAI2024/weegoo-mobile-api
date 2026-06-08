import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { PaginationInput, Rides, User, RidesDocument, PromoCode, CreatePromoCodeInput } from '@libs/data-access';
import { RidesService } from '../rides.service';
import { CurrentUser } from '@libs/common';
import { RideListWithPaginationResponse } from '@libs/data-access/dtos/response/ride-list-with-pagination.response';
import { Types } from 'mongoose';
import { CancelRideInput } from '@libs/data-access/dtos/input/cancel-ride.input';
import { CancelRideResponse } from '@libs/data-access/dtos/response/cancel-ride.response';
import { GetRideByIdInput } from '@libs/data-access/dtos/input/get-ride-by-id.input';

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

   @Query(() => [Rides])
  async dashboardHomeApi(
    @CurrentUser() driver: User,
  ) {
    return this.ridesService.homeDashboardApi(
      driver
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

@Query(() => Rides, { name: 'getRideById' })
  async getRideById(
    @CurrentUser() user: User,
    @Args('input') input: GetRideByIdInput,
  ) {
    return this.ridesService.getRideById(input.rideId, user._id);
  }

  @Mutation(() => CancelRideResponse)
  async cancelRide(
    @CurrentUser() user: User,
    @Args('input') input: CancelRideInput,
  ) {
    return this.ridesService.cancelRide(user, input);
  }
  
    @Mutation(() => PromoCode, { name: 'createPromoCode', description: 'Creates a new promo code' })
  async createPromoCode(
    @Args('input') input: CreatePromoCodeInput,
  ): Promise<PromoCode> {
    return this.ridesService.createPromoCode(input);
  }
}
