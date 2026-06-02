import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { TriggerInstantMatchmakingInput, TriggerScheduledMatchmakingInput, UpdateLocationInput, User } from '@libs/data-access';
import { MatchmakingIntegrationService } from '../matchmaking-integration.service';
import { TriggerMatchmakingResultResponse, LocationUpdateResult } from '../../../../../../libs/data-access/dtos/response/match-making.response';

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
   * Update the current passenger's location for the active ride.
   * Publishes location to the unified ride channel WG-RIDE-{rideUUId}-ride-details and updates
   * distanceToReachPassenger/estimatedTimeToReachPassenger in ride schema.
   */
  @Mutation(() => LocationUpdateResult, {
    name: 'updatePassengerLocation',
    description: 'Update passenger current location for real-time tracking and distance calculation',
  })
  async updatePassengerLocation(
    @CurrentUser() user: User,
    @Args('input') input: UpdateLocationInput,
  ): Promise<LocationUpdateResult> {
    this.logger.log(`GraphQL: updatePassengerLocation called by user ${user._id}`);
    return this.matchmakingIntegration.updatePassengerLocation(
      user._id.toString(),
      input.latitude,
      input.longitude,
    );
  }
}
