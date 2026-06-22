import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { DriverTodayEarningResponse } from '@libs/data-access/dtos/response/driver-todays-earning.response';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { TransactionListWithPaginationResponse } from '@libs/data-access/dtos/response/transaction-list-with-pagination.response';
import { TransactionPaginationInput } from '@libs/data-access/dtos/input/transaction-pagination.input';
import { Pagination } from '@libs/data-access/base/base.response';

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class TransactionResolver {
  constructor(
    private readonly transactionService: TransactionService,
  ) {}

  @Query(() => DriverTodayEarningResponse)
  async getDriverTodayEarning(
    @CurrentUser() driver: User,
  ) {
    return this.transactionService.getDriversEarningByDate(
      driver._id.toString(),
    );
  }
}
