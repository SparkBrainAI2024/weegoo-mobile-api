import { Module } from "@nestjs/common";
import { RatingResolver } from "./resolver/rating.resolver";
import { RatingService } from "./rating.service";
import { RatingPersistentModule } from "./rating-persistent.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

@Module({
  imports: [
    RatingPersistentModule,
    UserPersistenceModule,
  ],
  providers: [RatingResolver, RatingService],
  exports: [RatingService],
})
export class RatingModule {}