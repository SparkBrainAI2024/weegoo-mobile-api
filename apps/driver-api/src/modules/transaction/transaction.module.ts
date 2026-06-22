import { TransactionPersistenceModule } from '@libs/services/payment/src/transaction/transaction-persistence.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { Module } from '@nestjs/common';

import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { WalletModule } from '@libs/services/payment/src/wallet/wallet.module';
import { EnvService } from '@libs/common/config/env.service';
import { TransactionResolver } from './resolver/transaction.resolver';


@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule,
    WalletModule,
  ],
  providers: [TransactionService, TransactionResolver, EnvService],
  exports: [TransactionService, TransactionResolver],
})
export class TransactionModule {}