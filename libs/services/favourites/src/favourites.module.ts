import { Module } from "@nestjs/common";
import { FavouritesPersistentModule } from "./favourites-persistent.module";
import { FavouriteService } from "./favourites.service";
import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
@Module({
  imports: [FavouritesPersistentModule, RidePersistentModule],
  providers: [FavouriteService],
  exports: [FavouriteService]
})
export class FavouritesModule {}