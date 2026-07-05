import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { Logger, UseGuards, BadRequestException, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { TriggerInstantMatchmakingInput, TriggerScheduledMatchmakingInput, User, TriggerMatchmakingResultResponse, VehicleEstimateGraphQL, RideLocationInput, BasicResponse, roles } from '@libs/data-access';
import { MatchmakingIntegrationService } from '../matchmaking-integration.service';
@Resolver()
@UseGuards(AuthGuard,RoleGuard)
@SetMetadata('roles', [roles.USER])
export class MatchmakingResolver {
  private readonly logger = new Logger(MatchmakingResolver.name);

  constructor(private readonly matchmakingIntegration: MatchmakingIntegrationService) {}

  /**
   * Create an instant ride, trigger matchmaking.
   * If matchmaking fails, the ride is deleted.
   * If successful, the ride stays saved with the matched driver.
   */
  @Mutation(() => TriggerMatchmakingResultResponse, {
    name: 'requestInstantRide',
    description: 'Create an instant ride with pickup/dropoff/vehicle type, then match drivers via expanding-ring algorithm',
  })
  async requestInstantRide(
    @CurrentUser() user: User,
    @Args('input') input: TriggerInstantMatchmakingInput,
  ): Promise<TriggerMatchmakingResultResponse> {
    this.logger.log(`GraphQL: requestInstantRide called by user ${user._id}`);
    try {
      const response = await this.matchmakingIntegration.triggerInstantMatchmaking(
        user._id.toString(),
        input.pickupLocation,
        input.dropoffLocation,
        input.vehicleType,
      );
      this.logger.log(`GraphQL: requestInstantRide response ${user._id}: ${JSON.stringify(response)}`);
      
      // Reconstruct a clean response object to ensure GraphQL can serialize it properly.
      // NestJS GraphQL can sometimes fail to serialize plain JS objects even when cast with 'as any',
      // especially when fields like rideId/rideUUId are non-nullable String.
      return {
        success: response.success ?? false,
        message: response.message ?? '',
        matched: response.matched ?? false,
        rideId: response.rideId ?? '',
        rideUUId: response.rideUUId ?? '',
        driverId: response.driverId,
        driverName: response.driverName,
        driverImage: response.driverImage,
        rating: response.rating,
        rideType: response.rideType,
        rideStatus: response.rideStatus,
        attempts: response.attempts,
        estimatedFare: response.estimatedFare,
        estimatedFareTotal: response.estimatedFareTotal,
        estimatedTimeInMinutes: response.estimatedTimeInMinutes,
        distanceInKm: response.distanceInKm,
        noOfPassengers: response.noOfPassengers,
        ablyChannelId: response.ablyChannelId,
        driverLocationChannel: response.driverLocationChannel,
        pickupLocation: response.pickupLocation,
        dropoffLocation: response.dropoffLocation,
        acceptedDetails: response.acceptedDetails,
      };
    } catch (error: any) {
      this.logger.error(`GraphQL: requestInstantRide error for user ${user._id}: ${error?.message || error}`);
      throw new BadRequestException(error?.message || 'Failed to process ride request');
    }
  }

  /**
   * Create a scheduled ride and trigger scheduled matchmaking.
   * rideType: SCHEDULED, bookingTime, noOfPassengers (default 1).
   */
  @Mutation(() => TriggerMatchmakingResultResponse, {
    name: 'requestScheduledRide',
    description: 'Create a scheduled ride with pickup/dropoff and booking time, then match drivers via expanding-ring algorithm',
  })
  async requestScheduledRide(
    @CurrentUser() user: User,
    @Args('input') input: TriggerScheduledMatchmakingInput,
  ): Promise<TriggerMatchmakingResultResponse> {
    this.logger.log(`GraphQL: requestScheduledRide called by user ${user._id}`);
    return this.matchmakingIntegration.createAndMatchScheduledRide(
      user._id.toString(),
      input.pickupLocation,
      input.dropoffLocation,
      input.vehicleType,
      input.bookingTime,
      input.noOfPassengers || 1,
    );
  }

  /**
   * Get list of vehicle estimates (Car, Motorbike, Scooter) for a given route.
   */
  /**
   * Cancel an instant ride request before pickup.
   * If driver already accepted, notifies driver via Ably with cancelled=true payload,
   * deletes the ride, and stops matchmaking.
   */
  @Mutation(() => BasicResponse, {
    name: 'cancelInstantRide',
    description: 'Cancel an instant ride request. If driver already accepted, notifies driver with cancelled=true payload and deletes the ride.',
  })
  async cancelInstantRide(
    @CurrentUser() user: User,

  ): Promise<BasicResponse> {
    this.logger.log(`GraphQL: cancelInstantRide called by user ${user._id}`);
    return this.matchmakingIntegration.cancelInstantRide(
    user._id.toString(),
    );
  }

  @Query(() => [VehicleEstimateGraphQL], {
    name: 'getVehicleEstimates',
    description: 'Calculate estimates for CAR, MOTORBIKE, and SCOOTER between pickup and dropoff',
  })
  async getVehicleEstimates(
    @Args('pickupLocation') pickup: RideLocationInput,
    @Args('dropoffLocation') dropoff: RideLocationInput,
    @Args('noOfPassengers', { type: () => Int }) noOfPassengers: number,
  ): Promise<VehicleEstimateGraphQL[]> {
    if (noOfPassengers < 1) {
      throw new BadRequestException('Minimum number of passengers is 1');
    }
    if (noOfPassengers > 4) {
      throw new BadRequestException('Maximum number of passengers is 4');
    }

    return this.matchmakingIntegration.getVehicleEstimates(
      pickup,
      dropoff,
      noOfPassengers,
    );
  }
}
