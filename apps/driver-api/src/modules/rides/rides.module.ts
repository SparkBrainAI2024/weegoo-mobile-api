import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { DriverRideAcceptanceService } from "./driver-ride-acceptance.service";
import { DriverRideLocationResolver } from "./driver-ride-location.resolver";
import { TransactionModule } from "../transaction/transaction.module";

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
        DriverRideLocationResolver,
    ],
    exports: [RidesService]
})
export class RidesModule { }
