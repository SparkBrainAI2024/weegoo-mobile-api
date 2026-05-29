import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User } from '@libs/data-access';
import { MatchmakingIntegrationService } from './matchmaking-integration.service';
import { TriggerInstantMatchmakingInput } from './dto/matchmaking-input.dto';
import { TriggerMatchmakingResult } from './dto/matchmaking-response.dto';

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
  @Mutation(() => TriggerMatchmakingResult, {
    name: 'requestInstantRide',
    description: 'Create an instant ride with pickup/dropoff/vehicle type, then match drivers via expanding-ring algorithm',
  })
  async requestInstantRide(
    @CurrentUser() user: User,
    @Args('input') input: TriggerInstantMatchmakingInput,
  ): Promise<TriggerMatchmakingResult> {
    this.logger.log(`GraphQL: requestInstantRide called by user ${user._id}`);
    return this.matchmakingIntegration.triggerInstantMatchmaking(
      user._id.toString(),
      input.pickupLocation,
      input.dropoffLocation,
      input.vehicleType,
    );
  }
}