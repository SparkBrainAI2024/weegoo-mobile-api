import { Transaction, TransactionSchema } from '@libs/data-access/entities/transaction.entity';
import { User, UserSchema } from '@libs/data-access/entities/user.entity';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },{
        name:User.name, schema: UserSchema  
      }
    ]),
  ],
  providers: [TransactionRepository],
  exports: [TransactionRepository, MongooseModule],
})
export class TransactionPersistenceModule {}