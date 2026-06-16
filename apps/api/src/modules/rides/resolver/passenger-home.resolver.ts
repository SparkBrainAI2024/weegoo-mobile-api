import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { PassengerHomeResponse } from '@libs/data-access/dtos/response/passenger-home.response';
import { PassengerHomeService } from '../passenger-home.service';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.USER])
export class PassengerHomeResolver {
  constructor(private readonly passengerHomeService: PassengerHomeService) {}

  @Query(() => PassengerHomeResponse, {
    name: 'getPassengerHomeData',
    description:
      'Returns home/work locations, active promo codes, and vehicle estimates for the logged-in passenger. No input required.',
  })
  async getPassengerHomeData(
    @CurrentUser() user: User,
  ): Promise<PassengerHomeResponse> {
    return this.passengerHomeService.getPassengerHomeData(user._id.toString());
  }
}