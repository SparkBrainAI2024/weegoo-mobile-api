import { Module } from '@nestjs/common';
import { TransactionPersistenceModule } from './transaction-persistence.module';
import { TransactionService } from './transaction.service';

@Module({
  imports: [
    TransactionPersistenceModule,
  ],
  providers: [TransactionService],
  exports: [TransactionService, ],
})
export class TransactionModule {}