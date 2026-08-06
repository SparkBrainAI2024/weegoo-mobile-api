import { TransactionPersistenceModule } from '@libs/services/payment/src/transaction/transaction-persistence.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { WalletModule } from '@libs/services/payment/src/wallet/wallet.module';
import { EnvService } from '@libs/common/config/env.service';
import { TransactionResolver } from './resolver/transaction.resolver';
import { UserTransactionResolver } from '@libs/services/payment/src/transaction/resolver/transaction.resolver';
import { AcknowledgeAndFinishResolver } from './acknowledge-and-finish.resolver';
import { DriverEarningHistoryResolver } from './resolver/driver-earning-history.resolver';
import { DriverEarningsSummaryResolver } from './resolver/driver-earnings-summary.resolver';


@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule,
    WalletModule,
    HttpModule,
  ],
  providers: [TransactionService, TransactionResolver, EnvService, UserTransactionResolver, AcknowledgeAndFinishResolver, DriverEarningHistoryResolver, DriverEarningsSummaryResolver],
  exports: [TransactionService, TransactionResolver],
})
export class TransactionModule {}
