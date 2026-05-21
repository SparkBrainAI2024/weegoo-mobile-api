import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WalletTransaction, WalletTransactionSchema } from './transaction.schema';
import { TransactionRepository } from './transaction.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WalletTransaction.name, schema: WalletTransactionSchema },
    ]),
  ],
  providers: [TransactionRepository],
  exports: [TransactionRepository], // only repo exported, not the model directly
})
export class TransactionPersistenceModule {}