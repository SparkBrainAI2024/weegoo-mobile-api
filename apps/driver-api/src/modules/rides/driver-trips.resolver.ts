import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { RidesService } from '@libs/services/rides';
import { GetDriverTripsInput } from '@libs/data-access/dtos/input/get-driver-trips.input';
import { GetDriverTripsResponse } from '@libs/data-access/dtos/response/get-driver-trips.response';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class DriverTripsResolver {
  constructor(private readonly ridesService: RidesService) {}

  @Query(() => GetDriverTripsResponse, {
    name: 'getDriverTrips',
    description:
      'Get driver trips with commission info, wallet balance and pagination. Filter: ALL, DUE, PAID.',
  })
  async getDriverTrips(
    @CurrentUser() driver: User,
    @Args('input', { type: () => GetDriverTripsInput, nullable: true })
    input?: GetDriverTripsInput,
  ): Promise<GetDriverTripsResponse> {
    const filter = (input?.filter || 'ALL') as 'ALL' | 'DUE' | 'PAID';
    const page = input?.page || 0;
    const limit = input?.limit || 10;

    const { data, total, walletAmount, totalCommission } =
      await this.ridesService.getDriverTripsWithCommission(
        driver._id.toString(),
        filter,
        page,
        limit,
      );

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages - 1;
    const hasPreviousPage = page > 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : undefined,
        previousPage: hasPreviousPage ? page - 1 : undefined,
      },
      walletAmount,
      totalCommission,
    };
  }
}
