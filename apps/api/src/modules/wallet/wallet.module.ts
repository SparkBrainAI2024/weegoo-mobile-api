import { Module } from '@nestjs/common';
import { WalletModule } from '@libs/services/payment/src/wallet/wallet.module';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';
import { WalletResolver } from './wallet.resolver';
import { PaymentController } from './payment.controller';

@Module({
  imports: [WalletModule, UserPersistenceModule],
  providers: [WalletResolver],
  controllers: [PaymentController],
  exports: [],
})
export class WalletApiModule {}