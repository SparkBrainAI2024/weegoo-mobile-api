import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { Logger, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser, Roles } from '@libs/common';
import { User, roles, BasicResponse, CompleteRideInput, Rides } from '@libs/data-access';
import { DriverRideAcceptanceService } from './driver-ride-acceptance.service';
import { RoleGuard } from '@libs/guards/role.guard';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
export class DriverRideResolver {
  private readonly logger = new Logger(DriverRideResolver.name);

  constructor(
    private readonly driverRideAcceptanceService: DriverRideAcceptanceService,
  ) { }
  @Roles(roles.RIDER)
  @Mutation(() => BasicResponse, {
    name: 'acceptRide',
    description: 'Driver accepts a ride request (RIDER role only)',
  })
  async acceptRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<BasicResponse> {
    return this.driverRideAcceptanceService.acceptRide(rideId, user._id.toString());
  }
  @Roles(roles.RIDER)
  @Mutation(() => BasicResponse, {
    name: 'rejectRide',
    description: 'Driver rejects a ride request (RIDER role only)',
  })
  async rejectRide(
    @CurrentUser() user: User,
    @Args('rideId') rideId: string,
  ): Promise<BasicResponse> {
    this.logger.log(`GraphQL: Driver ${user._id} rejecting ride ${rideId}`);
    return this.driverRideAcceptanceService.rejectRide(rideId, user._id.toString());
  }

  @Roles(roles.RIDER)
  @Mutation(() => Rides, {
    name: 'completeRide',
    description: 'Driver completes a ride. Handles fare calculation, transactions, and payment updates.',
  })
  async completeRide(
    @CurrentUser() user: User,
    @Args('input') input: CompleteRideInput,
  ): Promise<Rides> {
    this.logger.log(`GraphQL: Driver ${user._id} completing ride ${input.rideId}`);
    return this.driverRideAcceptanceService.completeRide(input, user._id.toString());
  }
}
