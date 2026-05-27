import { Paginated } from "@libs/data-access/base/base.response";
import { Favourites } from "@libs/data-access/entities/favourites.entity";
import { ObjectType } from "@nestjs/graphql";

@ObjectType()
export class FavouriteListWithPaginationResponse extends Paginated(Favourites) {}