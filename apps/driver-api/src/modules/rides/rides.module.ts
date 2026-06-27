import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { DriverRideAcceptanceService } from "./driver-ride-acceptance.service";
import { DriverRideResolver } from "./driver-ride.resolver";
import { TransactionModule } from "../transaction/transaction.module";
import { S3Module } from "@libs/s3";

@Module({
    imports: [
        RidePersistentModule,
        UserPersistenceModule,
        TransactionModule,
        S3Module,
        IssuePersistenceModule,
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
