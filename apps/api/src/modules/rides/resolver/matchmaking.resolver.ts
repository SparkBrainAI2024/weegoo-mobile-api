import { Resolver, Mutation, Args, Query, Int } from '@nestjs/graphql';
import { Logger, UseGuards, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { TriggerInstantMatchmakingInput, TriggerScheduledMatchmakingInput, User, TriggerMatchmakingResultResponse, VehicleEstimateGraphQL, RideLocationInput } from '@libs/data-access';
import { MatchmakingIntegrationService } from '../matchmaking-integration.service';
@Resolver()
@UseGuards(AuthGuard)
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
    return this.matchmakingIntegration.triggerInstantMatchmaking(
      user._id.toString(),
      input.pickupLocation,
      input.dropoffLocation,
      input.vehicleType,
    );
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
