import { Module } from "@nestjs/common";
import { ProfileService } from "./profile.service";
import { ProfileResolver } from "./resolver/profile.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { RidePersistentModule } from "@libs/services/rides";
import { TransactionPersistenceModule } from "@libs/services/payment/src/transaction/transaction-persistence.module";
import { WalletPersistenceModule } from "@libs/services/payment/src/wallet/wallet-persistence.module";
import { FavouritesPersistentModule } from "@libs/services/favourites/favourites-persistent.module";
import { NotificationPersistentModule } from "@libs/services/notification/notification-persistent.module";
import { RatingPersistentModule } from "@libs/services/rating/src/rating-persistent.module";

@Module({
  imports: [
    UserPersistenceModule,
    RidePersistentModule,
    TransactionPersistenceModule,
    WalletPersistenceModule,
    FavouritesPersistentModule,
    NotificationPersistentModule,
    RatingPersistentModule,
    
  ],
  providers: [ProfileService, ProfileResolver],
  exports: [ProfileService],
})
export class ProfileModule {}
