import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { DriverEarningHistoryResponse } from '@libs/data-access/dtos/response/driver-earning-history.response';
import { TransactionPaginationInput } from '@libs/data-access/dtos/input/transaction-pagination.input';
import { Pagination } from '@libs/data-access/base/base.response';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class DriverEarningHistoryResolver {
  constructor(
    private readonly transactionService: TransactionService,
  ) {}

  @Query(() => DriverEarningHistoryResponse)
  async getDriverEarningHistory(
    @CurrentUser() driver: User,
    @Args('input', { type: () => TransactionPaginationInput })
    input: TransactionPaginationInput,
  ): Promise<DriverEarningHistoryResponse> {
    const result = await this.transactionService.getDriverEarningHistory(
      driver._id.toString(),
      input.page,
      input.limit,
    );

    return {
      data: result.data,
      pagination: result.pagination as Pagination,
      totalEarnings: result.totalEarnings,
    };
  }
}