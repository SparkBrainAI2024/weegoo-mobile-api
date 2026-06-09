import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles, BasicResponse} from '@libs/data-access';
import { DriverRideAcceptanceService } from './driver-ride-acceptance.service';

@Resolver()
@UseGuards(AuthGuard)
export class DriverRideResolver {
  private readonly logger = new Logger(DriverRideResolver.name);

  constructor(
    private readonly driverRideAcceptanceService: DriverRideAcceptanceService,
  ) {}

  @Mutation(() => BasicResponse, {
    name: 'acceptRide',
    description: 'Driver accepts a ride request (RIDER role only)',
  })
  async acceptRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<BasicResponse> {
    this.logger.log(`GraphQL: Driver ${user._id} accepting ride ${rideId}`);
    
    // Only RIDER role can accept rides
    if (user.loginAs !== roles.RIDER) {
      throw new ForbiddenException('Only drivers can accept rides');
    }
    
    return this.driverRideAcceptanceService.acceptRide(rideId, user._id.toString());
  }

  @Mutation(() => BasicResponse, {
    name: 'rejectRide',
    description: 'Driver rejects a ride request (RIDER role only)',
  })
  async rejectRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<BasicResponse> {
    this.logger.log(`GraphQL: Driver ${user._id} rejecting ride ${rideId}`);
    
    // Only RIDER role can reject rides
    if (user.loginAs !== roles.RIDER) {
      throw new ForbiddenException('Only drivers can reject rides');
    }
    
    return this.driverRideAcceptanceService.rejectRide(rideId, user._id.toString());
  }
}
