import {
    Favourites,
    FavouritesSchema,
    FavouritesRepository,
    UserSchema,
    User,
} from "@libs/data-access";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Favourites.name, schema: FavouritesSchema },
        ]),
    ],
    providers: [FavouritesRepository],
    exports: [FavouritesRepository, MongooseModule],
})
export class FavouritesPersistentModule { }
