import { RidePersistentModule, RidesService, RidesResolver } from "@libs/services/rides";
import { Module } from "@nestjs/common";

@Module({
    imports: [
        RidePersistentModule,
    ],
    providers: [
        RidesService,
        RidesResolver,
    ],
    exports: [RidesService]
})
export class RidesModule { }
