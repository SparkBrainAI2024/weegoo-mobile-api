import { Module } from "@nestjs/common";
import { FavouritesResolver } from "./user-favourites.resolver";
import { FavouritesModule } from "@libs/services/favourites/favourites.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
import { UserServiceModule } from "@libs/services/user/user.module";

@Module({
    imports: [
        FavouritesModule,
        UserPersistenceModule,
        RidePersistentModule,
        UserServiceModule
    ],
    providers: [
        FavouritesResolver
    ],
})
export class UserFavouritesModule { }
