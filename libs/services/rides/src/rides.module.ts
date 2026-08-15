import { Module } from '@nestjs/common';
import { RidesResolver } from './resolver/rides.resolver';
import { RidesService } from './rides.service';
import { RidePersistentModule } from './rides-persistent.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { IssuePersistenceModule } from '@libs/services/issue/src/issue-persistence.module';
import { WalletModule } from '@libs/services/payment/src/wallet/wallet.module';
import { TransactionPersistenceModule } from '@libs/services/payment/src/transaction/transaction-persistence.module';

@Module({
  imports: [
    RidePersistentModule,
    IssuePersistenceModule,
    WalletModule,
    TransactionPersistenceModule,
  ],
  providers: [RidesResolver,RidesService,TransactionService],
})
export class UserRidesModule {}
