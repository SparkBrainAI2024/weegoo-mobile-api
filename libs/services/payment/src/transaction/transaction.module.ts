import { Module } from '@nestjs/common';

@Module({
  imports: [
    TransactionPersistenceModule,
  ],
  providers: [TransactionService],
  exports: [TransactionService],
})
export class TransactionModule {}