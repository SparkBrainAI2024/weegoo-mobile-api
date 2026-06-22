import { Module, forwardRef } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionPersistenceModule } from './transaction-persistence.module';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule,
    forwardRef(() => WalletModule),
  ],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
