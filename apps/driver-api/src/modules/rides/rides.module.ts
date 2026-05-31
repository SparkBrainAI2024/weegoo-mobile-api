import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Rides, RidesSchema } from "@libs/data-access/entities/rides.entity";
import { User, UserSchema } from "@libs/data-access/entities/user.entity";
import { UserDetails, UserDetailsSchema } from "@libs/data-access/entities/user-details.entity";
import { Vehicle, VehicleSchema } from "@libs/data-access/entities/vehicle.entity";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { DriverRideAcceptanceService } from "./driver-ride-acceptance.service";
import { TransactionModule } from "../transaction/transaction.module";

@Module({
    imports: [
        RidePersistentModule,
        UserPersistenceModule,
        TransactionModule,
        IssuePersistenceModule,
        // Provide models for DriverRideAcceptanceService @InjectModel decorators
        MongooseModule.forFeature([
            { name: Rides.name, schema: RidesSchema },
            { name: User.name, schema: UserSchema },
            { name: UserDetails.name, schema: UserDetailsSchema },
            { name: Vehicle.name, schema: VehicleSchema },
        ]),
    ],
    providers: [
        RidesService,
        RidesResolver,
        EnvService,
        DriverRideAcceptanceService,
    ],
    exports: [RidesService]
})
export class RidesModule { }