import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User } from '@libs/data-access';
import { TransactionService } from '../transaction.service';
import { DriverTodayEarningResponse } from '@libs/data-access/dtos/response/driver-todays-earning.response';



@Resolver()
@UseGuards(AuthGuard)
export class DriverEarningResolver {
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