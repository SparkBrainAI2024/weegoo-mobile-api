import { Rides, RidesSchema, RidesRepository, User, Vehicle, VehicleSchema, UserSchema } from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Rides.name, schema: RidesSchema },
            { name: User.name, schema: UserSchema },
            { name: Vehicle.name, schema: VehicleSchema },
        ]),
    ],
    providers: [
        RidesRepository,
    ],
    exports: [
        RidesRepository
    ],
})
export class RidePersistentModule { }