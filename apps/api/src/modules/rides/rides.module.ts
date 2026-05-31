import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { TransactionModule } from "@libs/services/payment/src/transaction/transaction.module";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";

@Module({
    imports: [
        RidePersistentModule,
        UserPersistenceModule,
        TransactionModule,
        IssuePersistenceModule
    ],
    providers: [
        RidesService,
        RidesResolver,
        EnvService,
    ],
    exports: [RidesService]
})
export class RidesModule { }
