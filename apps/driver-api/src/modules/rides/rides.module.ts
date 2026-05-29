import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { TransactionModule } from "@libs/services/payment/src/transaction/transaction.module";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { DriverRideAcceptanceService } from "./driver-ride-acceptance.service";
import { AblyRideListenerService } from "@libs/services/ably";

@Module({
    imports: [
        RidePersistentModule,
        UserPersistenceModule,
        TransactionModule,
        IssuePersistenceModule,
    ],
    providers: [
        RidesService,
        RidesResolver,
        EnvService,
        DriverRideAcceptanceService,
        AblyRideListenerService,
    ],
    exports: [RidesService]
})
export class RidesModule { }