import { Module, forwardRef } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { TransactionPersistenceModule } from "./transaction-persistence.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { WalletModule } from "../wallet/wallet.module";
import { UserTransactionResolver } from "./resolver/transaction.resolver";
import { EnvService } from "@libs/common/config/env.service";
import { TransactionRepository } from "@libs/data-access/repositories/transaction.repository";

@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule,
    forwardRef(() => WalletModule),
  ],
  providers: [TransactionService, UserTransactionResolver, EnvService, TransactionRepository],
  exports: [TransactionService, UserTransactionResolver, TransactionRepository],
})
export class TransactionModule {}
