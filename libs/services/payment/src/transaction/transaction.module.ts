import { Module } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionPersistenceModule } from './transaction-persistence.module';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';
import { TransactionResolver } from '@driver-api/modules/transaction/resolver/transaction.resolver';

@Module({
  imports: [TransactionPersistenceModule, UserPersistenceModule],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}
