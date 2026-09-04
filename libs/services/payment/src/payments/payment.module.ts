import { Module } from "@nestjs/common";
import { WalletService } from "../wallet/wallet.service";
import { WalletPersistenceModule } from "../wallet/wallet-persistence.module";
import { TransactionPersistenceModule } from "../transaction/transaction-persistence.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { EsewaModule } from "../esewa/esewa.module";
import { KhaltiModule } from "../khalti/khalti.module";
import { NotificationPersistentModule } from "@libs/services/notification/notification-persistent.module";
import { NotificationService } from "@libs/services/notification/notification.service";
import { FirebaseMessagingService } from "@libs/services/firebase-messaging/firebase-messaging.service";
import { PaymentsService } from "./payment.service";

@Module({
  imports: [
    WalletPersistenceModule,
    TransactionPersistenceModule,
    UserPersistenceModule,
    EsewaModule,
    KhaltiModule,
    NotificationPersistentModule,
  ],
  providers: [
    WalletService,
    EnvService,
    NotificationService,
    FirebaseMessagingService,
    PaymentsService,
  ],
  exports: [WalletService, PaymentsService],
})
export class PaymentsModule {}
