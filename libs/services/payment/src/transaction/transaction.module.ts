import { Module, forwardRef } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionPersistenceModule } from './transaction-persistence.module';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';
import { WalletModule } from '../wallet/wallet.module';
import { UserTransactionResolver } from './resolver/transaction.resolver';

@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule,
    forwardRef(() => WalletModule),
  ],
  providers: [TransactionService, UserTransactionResolver],
  exports: [TransactionService, UserTransactionResolver],
})
export class TransactionModule {}