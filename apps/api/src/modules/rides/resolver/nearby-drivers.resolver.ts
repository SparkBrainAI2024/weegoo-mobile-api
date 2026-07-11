import { Resolver, Query, Args, Float } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { NearbyDriversSubscriptionResponse } from '@libs/data-access/dtos/response/nearby-driver.response';
import { NearbyDriversService } from '../nearby-drivers.service';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.USER])
export class NearbyDriversResolver {
  constructor(private readonly nearbyDriversService: NearbyDriversService) {}

  @Query(() => NearbyDriversSubscriptionResponse, {
    name: 'getNearbyDrivers',
    description:
      'Find nearby available drivers within 1-10 km radius. Returns driver name, image, location, rating, vehicle details. Skips offline, unverified, suspended drivers, or those with active rides or no Firebase token.',
  })
  async getNearbyDrivers(
    @CurrentUser() user: User,
    @Args('latitude', { type: () => Float }) latitude: number,
    @Args('longitude', { type: () => Float }) longitude: number,
    @Args('radiusKm', { type: () => Float, nullable: true, defaultValue: 10 }) radiusKm?: number,
  ): Promise<NearbyDriversSubscriptionResponse> {
    return this.nearbyDriversService.getNearbyDrivers(
      user._id.toString(),
      latitude,
      longitude,
      radiusKm,
    );
  }
}