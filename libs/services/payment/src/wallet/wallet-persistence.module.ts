import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wallet, WalletSchema } from '@libs/data-access/entities/wallet.entity';
import { WalletRepository } from '@libs/data-access/repositories/wallet.repository';
import {
  Transaction,
  TransactionSchema,
} from '@libs/data-access/entities/transaction.entity';
import {
  UserDetails,
  UserDetailsSchema,
} from '@libs/data-access/entities/user-details.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
    ]),
  ],
  providers: [WalletRepository],
  exports: [WalletRepository],
})
export class WalletPersistenceModule {}