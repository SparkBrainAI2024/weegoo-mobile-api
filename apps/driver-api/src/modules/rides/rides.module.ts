import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { DriverRideAcceptanceService } from "./driver-ride-acceptance.service";
import { DriverRideResolver } from "./driver-ride.resolver";
import { TransactionModule } from "../transaction/transaction.module";
import { S3Module } from "@libs/s3";
import { WalletModule } from "@libs/services/payment/src/wallet/wallet.module";
import { Transaction, TransactionSchema } from "@libs/data-access/entities/transaction.entity";

@Module({
    imports: [
        RidePersistentModule,
        UserPersistenceModule,
        TransactionModule,
        S3Module,
        WalletModule,
        IssuePersistenceModule,
        MongooseModule.forFeature([
            { name: Transaction.name, schema: TransactionSchema },
        ]),
    ],
    providers: [
        RidesService,
        RidesResolver,
        EnvService,
        DriverRideAcceptanceService,
        DriverRideResolver,
    ],
    exports: [RidesService]
})
export class RidesModule { }