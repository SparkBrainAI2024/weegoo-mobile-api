import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { transactionModel } from "@libs/data-access/entities/transaction.entity";
import { walletModel } from "@libs/data-access/entities/wallet.entity";
import { TransactionRepository } from "@libs/data-access/repositories/transaction.repository";
import { WalletRepository } from "@libs/data-access/repositories/wallet.repository";
import { PaymentsService } from "@libs/services/payment/src/payments/payment.service";
import { PaymentsResolver } from "./resolver/admin-payments.resolver";

@Module({
  imports: [MongooseModule.forFeature([transactionModel, walletModel])],
  providers: [
    TransactionRepository,
    WalletRepository,
    PaymentsService,
    PaymentsResolver,
  ],
})
export class PaymentsModule {}
