import { Module } from "@nestjs/common";
import { AdminRidesResolver } from "./resolver/ride.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";

import { UserAuthModule } from "@libs/services/auth/auth.module";
import { EnvService } from "@libs/common/config/env.service";
import { RidesService } from "@libs/services/rides/rides.service";
import { TransactionModule } from "@libs/services/payment/src/transaction/transaction.module";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { S3Module } from "@libs/s3";
import { WalletPersistenceModule } from "@libs/services/payment/src/wallet/wallet-persistence.module";
import { WalletModule } from "@libs/services/payment/src/wallet/wallet.module";
import { AdminAuthModule } from "../auth/auth.module";

@Module({
  imports: [
    UserAuthModule,
    UserPersistenceModule,
    RidePersistentModule,
    CommonVehicleModule,
    TransactionModule,
    IssuePersistenceModule,
    S3Module,
    WalletModule,
    AdminAuthModule,
  ],
  providers: [AdminRidesResolver, RidesService, EnvService],
  exports: [AdminRidesResolver],
})
export class AdminRidesModule {}
