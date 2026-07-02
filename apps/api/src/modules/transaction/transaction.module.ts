import { TransactionPersistenceModule } from '@libs/services/payment/src/transaction/transaction-persistence.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { Module } from '@nestjs/common';
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { WalletModule } from '@libs/services/payment/src/wallet/wallet.module';
import { EnvService } from '@libs/common/config/env.service';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminUser, AdminUserSchema } from '@libs/data-access/entities/admin-user.entity';
import { PassengerPaymentService } from './passenger-payment.service';
import { PassengerPaymentResolver } from './resolver/passenger-payment.resolver';
import { RidePersistentModule } from '@libs/services/rides/rides-persistent.module';
import { PromoCodePersistenceModule } from '@libs/services/promocode/src/promocode.persistence.module';

@Module({
  imports: [
    TransactionPersistenceModule,
    RidePersistentModule,
    UserPersistenceModule,
    WalletModule,
    PromoCodePersistenceModule,
    MongooseModule.forFeature([
      { name: AdminUser.name, schema: AdminUserSchema },
    ]),
  ],
  providers: [TransactionService, EnvService, PassengerPaymentService, PassengerPaymentResolver],
  exports: [PassengerPaymentService],
})
export class TransactionModule {}