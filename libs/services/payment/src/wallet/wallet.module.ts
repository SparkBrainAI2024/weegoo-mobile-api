import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletPersistenceModule } from './wallet-persistence.module';
import { TransactionPersistenceModule } from '../transaction/transaction-persistence.module';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';
import { EnvService } from '@libs/common/config/env.service';

@Module({
  imports: [
    WalletPersistenceModule,
    TransactionPersistenceModule,
    UserPersistenceModule,
  ],
  providers: [WalletService, EnvService],
  exports: [WalletService],
})
export class WalletModule {}
