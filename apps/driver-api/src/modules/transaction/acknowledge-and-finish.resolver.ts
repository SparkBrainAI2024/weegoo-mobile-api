import { Resolver, Mutation, Args, ObjectType, Field } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';

@ObjectType()
class AcknowledgeAndFinishResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => Boolean)
  isAcknowledged: boolean;
}

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class AcknowledgeAndFinishResolver {
  constructor(
    private readonly envService: EnvService,
  ) {}

  @Mutation(() => AcknowledgeAndFinishResult)
  async acknowledgeAndFinishRide(
    @CurrentUser() driver: User,
    @Args('rideId') rideId: string,
  ): Promise<AcknowledgeAndFinishResult> {
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');

    const query = `
      mutation AcknowledgeAndFinishRide($rideId: String!, $driverId: String!) {
        acknowledgeAndFinishRide(rideId: $rideId, driverId: $driverId) {
          success
          message
          acknowledged
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

      const result = response.data?.data?.acknowledgeAndFinishRide;
      if (result) {
        return {
          success: result.success,
          isAcknowledged: result.acknowledged,
        };
      }
      return {
        success: false,
        isAcknowledged: false,
      };
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
