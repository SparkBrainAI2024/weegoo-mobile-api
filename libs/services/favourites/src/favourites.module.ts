import { Module } from "@nestjs/common";
import { FavouritesPersistentModule } from "./favourites-persistent.module";
import { FavouriteService } from "./favourites.service";


@Module({
  imports: [FavouritesPersistentModule],
  providers: [FavouriteService],
  exports: [FavouriteService]
})
export class FavouritesModule {}