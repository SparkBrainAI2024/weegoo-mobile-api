import { Module } from "@nestjs/common";
import { RatingModule } from "@libs/services/rating/src/rating.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

@Module({
    imports: [
        RatingModule,
        UserPersistenceModule,
    ],
    providers: [],
    exports: [RatingModule],
})
export class RatingIModule {}