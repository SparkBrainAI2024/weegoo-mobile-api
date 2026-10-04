import { Module, forwardRef } from "@nestjs/common";
import { TransactionService } from "./transaction.service";
import { TransactionPersistenceModule } from "./transaction-persistence.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { WalletModule } from "../wallet/wallet.module";
import { UserTransactionResolver } from "./resolver/transaction.resolver";
import { EnvService } from "@libs/common/config/env.service";
import { TransactionRepository } from "@libs/data-access/repositories/transaction.repository";
import { MaintenanceInfoPersistenceModule } from "@libs/services/maintenance-info/maintenance-info.persistence.module";

/**
 * `UserTransactionResolver` is protected by `AuthGuard`, and guards referenced
 * by class are instantiated inside the module that declares the resolver.
 * `AuthGuard` injects `MaintenanceInfoService`, so this module has to import
 * `MaintenanceInfoPersistenceModule` itself (apps such as ride-matchmaking do
 * not load the auth module that would otherwise provide it).
 */
@Module({
  imports: [
    TransactionPersistenceModule,
    UserPersistenceModule,
    MaintenanceInfoPersistenceModule,
    forwardRef(() => WalletModule),
  ],
  providers: [TransactionService, UserTransactionResolver, EnvService, TransactionRepository],
  exports: [TransactionService, UserTransactionResolver, TransactionRepository],
})
export class TransactionModule {}
