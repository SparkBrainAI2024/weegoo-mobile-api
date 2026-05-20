import { Rides, RidesSchema, RidesRepository } from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Rides.name, schema: RidesSchema },
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