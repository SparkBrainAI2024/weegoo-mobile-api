import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Wallet, WalletSchema } from './wallet.schema';
import { WalletRepository } from './wallet.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Wallet.name, schema: WalletSchema },
    ]),
  ],
  providers: [WalletRepository],
  exports: [WalletRepository],
})
export class WalletPersistenceModule {}