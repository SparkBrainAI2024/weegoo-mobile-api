import { CurrentUser } from "@libs/common";
import {
  SaveLocationInput,
  DeleteLocationInput,
  SavedLocationsResponse,
  RecentPlace,
} from "@libs/data-access";
import { AuthGuard, LangGuard } from "@libs/guards";
import { UserDetailsService } from "@libs/services/user";
import { UseGuards } from "@nestjs/common";
import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";

@Resolver()
@UseGuards(AuthGuard, LangGuard)
export class SavedLocationResolver {
  constructor(private readonly userDetailsService: UserDetailsService) {}

  @Mutation(() => SavedLocationsResponse)
  setSavedLocation(
    @CurrentUser() user,
    @Args("input") input: SaveLocationInput,
  ) {
    return this.userDetailsService.saveLocation(user._id, input);
  }

  @Query(() => SavedLocationsResponse)
  getSavedLocation(@CurrentUser() user) {
    return this.userDetailsService.getSavedLocations(user._id);
  }

  @Mutation(() => SavedLocationsResponse)
  deleteSavedLocation(
    @CurrentUser() user,
    @Args("input") input: DeleteLocationInput,
  ) {
    return this.userDetailsService.deleteLocation(user._id, input);
  }

  @Query(() => [RecentPlace])
  getRecentPlaces(@CurrentUser() user) {
    return this.userDetailsService.getRecentPlaces(user._id);
  }
}
