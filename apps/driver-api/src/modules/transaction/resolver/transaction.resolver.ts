import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User } from '@libs/data-access';
import { DriverTodayEarningResponse } from '@libs/data-access/dtos/response/driver-todays-earning.response';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { UserTransactionResolver } from '@libs/services/payment/src/transaction/resolver/transaction.resolver';



@Resolver()
@UseGuards(AuthGuard)
export class TransactionResolver extends UserTransactionResolver{
  constructor(
    private readonly transactionService: TransactionService,
  ) {
    super();
  }

  @Query(() => DriverTodayEarningResponse)
  async getDriverTodayEarning(
    @CurrentUser() driver: User,
  ) {
    return this.transactionService.getDriversEarningByDate(
      driver._id.toString(),
    );
  }
}