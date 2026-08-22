import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles, ScheduledVehicleType } from '@libs/data-access';
import {
  PassengerHomeResponse,
  ScheduleVehicleTypeResponse,
} from '@libs/data-access/dtos/response/passenger-home.response';
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

  @Query(() => [ScheduleVehicleTypeResponse], {
    name: 'getQueryForScheduleVehicleType',
    description:
      'Returns the vehicle types available for scheduled rides (JEEP, MICRO, CAR only).',
  })
  async getQueryForScheduleVehicleType(): Promise<ScheduleVehicleTypeResponse[]> {
    return [
      { vehicleType: ScheduledVehicleType.JEEP, label: 'Jeep' },
      { vehicleType: ScheduledVehicleType.MICRO, label: 'Micro' },
      { vehicleType: ScheduledVehicleType.CAR, label: 'Car' },
    ];
  }
}
