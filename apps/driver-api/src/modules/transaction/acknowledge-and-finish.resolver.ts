import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class AcknowledgeAndFinishResolver {
  constructor(
    private readonly envService: EnvService,
  ) {}

  @Mutation(() => Boolean)
  async acknowledgeAndFinishRide(
    @CurrentUser() driver: User,
    @Args('rideId') rideId: string,
  ): Promise<boolean> {
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');

    const query = `
      mutation AcknowledgeAndFinishRide($rideId: String!, $driverId: String!) {
        acknowledgeAndFinishRide(rideId: $rideId, driverId: $driverId) {
          success
          message
        }
      }
    `;

    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query,
          variables: { rideId, driverId: driver._id },
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data?.data?.acknowledgeAndFinishRide) {
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error calling matchmaking service:', error);
      if (error.response?.data?.errors) {
        console.error('GraphQL errors:', JSON.stringify(error.response.data.errors, null, 2));
        throw new Error(`Failed to acknowledge and finish ride: ${error.response.data.errors[0]?.message || 'Unknown error'}`);
      }
      throw new Error('Failed to acknowledge and finish ride');
    }
  }
}