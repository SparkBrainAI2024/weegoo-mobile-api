import { Module } from "@nestjs/common";
import { FavouritesResolver } from "./user-favourites.resolver";
import { FavouritesModule } from "@libs/services/favourites/favourites.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import {  EnvService } from "@libs/common/config/env.service";

@Module({
    imports: [
        FavouritesModule,
        UserPersistenceModule,
    ],
    providers: [
        FavouritesResolver,
        EnvService
    ],
})
export class UserFavouritesModule { }
