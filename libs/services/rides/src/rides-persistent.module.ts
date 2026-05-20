import { Rides, RidesSchema, RidesRepository, UserSchema, User } from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Rides.name, schema: RidesSchema },
            { name: User.name, schema: UserSchema },    
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