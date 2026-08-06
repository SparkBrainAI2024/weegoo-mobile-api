import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { DriverEarningsSummaryResponse } from '@libs/data-access/dtos/response/driver-earnings-summary.response';
import { DriverEarningsSummaryInput } from '@libs/data-access/dtos/input/driver-earnings-summary.input';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class DriverEarningsSummaryResolver {
  constructor(
    private readonly transactionService: TransactionService,
  ) {}

  @Query(() => DriverEarningsSummaryResponse)
  async getDriverEarningsSummary(
    @CurrentUser() driver: User,
    @Args('input', { type: () => DriverEarningsSummaryInput })
    input: DriverEarningsSummaryInput,
  ): Promise<DriverEarningsSummaryResponse> {
    const result = await this.transactionService.getDriverEarningsSummary(
      driver._id.toString(),
      input,
    );

    return {
      totalEarnings: result.totalEarnings,
      netEarnings: result.netEarnings,
      commission: result.commission,
      tripsCompleted: result.tripsCompleted,
      paymentBreakdown: result.paymentBreakdown,
      averageEarning: result.averageEarning,
      totalOnlineHours: result.totalOnlineHours,
      commissionDue: result.commissionDue,
      recentEarnings: result.recentEarnings,
      tripIncrease: result.tripIncrease,
    };
  }
}