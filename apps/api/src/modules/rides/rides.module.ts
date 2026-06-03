import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { TransactionModule } from "@libs/services/payment/src/transaction/transaction.module";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { MatchmakingIntegrationService } from "./matchmaking-integration.service";
import { MatchmakingResolver } from "./resolver/matchmaking.resolver";

import { PassengerRidesResolver } from "./resolver/rides.resolver";
import { S3Module } from "@libs/s3/s3.module";
import { MongooseModule } from "@nestjs/mongoose";
import { Rides, RidesSchema, Vehicle, VehicleSchema } from "@libs/data-access";
@Module({
    imports: [
        RidePersistentModule,
        UserPersistenceModule,
        TransactionModule,
        IssuePersistenceModule,
        S3Module,
        MongooseModule.forFeature([
            { name: Rides.name, schema: RidesSchema },
            { name: Vehicle.name, schema: VehicleSchema },
        ]),
    ],
    providers: [
        RidesService,
        RidesResolver,
        EnvService,
        MatchmakingIntegrationService,
        MatchmakingResolver,
        PassengerRidesResolver
    ],
    exports: [RidesService]
})
export class RidesModule { }