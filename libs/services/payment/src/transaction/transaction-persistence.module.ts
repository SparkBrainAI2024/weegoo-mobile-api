import { Transaction, TransactionSchema } from '@libs/data-access/entities/transaction.entity';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
    ]),
  ],
  providers: [TransactionRepository],
  exports: [TransactionRepository], // only repo exported, not the model directly
})
export class TransactionPersistenceModule {}