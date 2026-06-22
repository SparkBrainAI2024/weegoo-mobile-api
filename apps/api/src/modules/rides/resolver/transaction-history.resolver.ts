import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { TransactionListWithPaginationResponse } from '@libs/data-access/dtos/response/transaction-list-with-pagination.response';
import { TransactionPaginationInput } from '@libs/data-access/dtos/input/transaction-pagination.input';
import { Transaction } from '@libs/data-access/entities/transaction.entity';
import { Pagination } from '@libs/data-access/base/base.response';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.USER, roles.RIDER])
export class TransactionHistoryResolver {
  constructor(private readonly transactionService: TransactionService) {}

  @Query(() => TransactionListWithPaginationResponse, {
    name: 'getTransactionHistory',
    description:
      'Returns paginated transaction history for the logged-in user. If logged in as USER (rider), queries by riderId. If logged in as RIDER (driver), queries by driverId.',
  })
  async getTransactionHistory(
    @CurrentUser() user: User,
    @Args('input', { type: () => TransactionPaginationInput })
    input: TransactionPaginationInput,
  ): Promise<TransactionListWithPaginationResponse> {
    const role = user.loginAs === roles.RIDER ? 'driver' : 'rider';
    const result = await this.transactionService.getTransactionHistory(
      user._id.toString(),
      role,
      input.page,
      input.limit,
    );

    return {
      data: result.data,
      pagination: result.pagination as Pagination,
    };
  }
}