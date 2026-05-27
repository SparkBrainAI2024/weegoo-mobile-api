import { TransactionPersistenceModule } from '@libs/services/payment/src/transaction/transaction-persistence.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { Module } from '@nestjs/common';

import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from '@libs/common/config/env.service';
import { UserTransactionResolver } from '@libs/services/payment/src/transaction/resolver/transaction.resolver';
import { TransactionResolver } from './resolver/transaction.resolver';


@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule
  ],
  providers: [TransactionService, UserTransactionResolver, TransactionResolver,EnvService],
  exports: [TransactionService, ],
})
export class TransactionModule {}