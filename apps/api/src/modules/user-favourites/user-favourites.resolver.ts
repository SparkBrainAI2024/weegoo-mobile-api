import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { 
  User, 
  Favourites, 
  PaginationInput, 
  CreateFavouriteInput ,
  FavouriteListWithPaginationResponse,
  PaginationInputOnly
} from '@libs/data-access';
import { FavouriteService } from '@libs/services/favourites/favourites.service';

@Resolver(() => Favourites)
@UseGuards(AuthGuard)
export class FavouritesResolver {
  constructor(private readonly favouriteService: FavouriteService) {}

  @Query(() => FavouriteListWithPaginationResponse, { name: 'getMyFavourites' })
  async getMyFavourites(
    @CurrentUser() user: User,
    @Args('options', { nullable: true }) options: PaginationInputOnly,
  ) {
    return this.favouriteService.findRides(user, options);
  }

  @Mutation(() => Favourites, { name: 'createFavourite' })
  async createFavourite(
    @CurrentUser() user: User,
    @Args('input') input: CreateFavouriteInput,
  ) {
    return this.favouriteService.createFavorite({
      ...input,
      passengerId: user._id,
    } as any);
  }
  @Query(() => Favourites, { name: 'getFavouriteById' })
  async getFavouriteById(
    @CurrentUser() user: User,
    @Args('favouriteId') favouriteId: string,
  ) {
    return this.favouriteService.getFavouriteById(favouriteId, user._id.toString());
  }
}