import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser, Roles, ROLES_KEY } from '@libs/common';
import {
    User,
    Favourites,
    CreateFavouriteInput,
    FavouriteListWithPaginationResponse,
    PaginationInputOnly,
    roles
} from '@libs/data-access';
import { FavouriteService } from '@libs/services/favourites/favourites.service';
import { RoleGuard } from '@libs/guards/role.guard';

@Resolver(() => Favourites)
@UseGuards(AuthGuard, RoleGuard)
export class FavouritesResolver {
    constructor(private readonly favouriteService: FavouriteService) { }
    @Roles(roles.USER)
    @Query(() => FavouriteListWithPaginationResponse, { name: 'getMyFavourites' })
    async getMyFavourites(
        @CurrentUser() user: User,
        @Args('options', { nullable: true }) options: PaginationInputOnly,
    ) {
        return this.favouriteService.findRides(user, options);
    }

    @Roles(roles.USER)
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
    @Roles(roles.USER)
    @Query(() => Favourites, { name: 'getFavouriteById' })
    async getFavouriteById(
        @CurrentUser() user: User,
        @Args('favouriteId') favouriteId: string,
    ) {
        return this.favouriteService.getFavouriteById(favouriteId, user._id.toString());
    }
}