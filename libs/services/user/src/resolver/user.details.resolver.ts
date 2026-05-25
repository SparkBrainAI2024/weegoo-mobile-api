import { CurrentLang, CurrentUser } from "@libs/common";
import { CreateUserDetailsInput, UserDetails, UserDetailsResponse } from "@libs/data-access";
import { AuthGuard, LangGuard } from "@libs/guards";
import { UserDetailsService } from "../user.details.services";
import { UseGuards } from "@nestjs/common";
import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";


@Resolver(() => UserDetailsResponse)
@UseGuards(AuthGuard, LangGuard)
export class UserDetailsResolver {
  constructor(private readonly userDetailsService: UserDetailsService) {}

  @Mutation(() => UserDetailsResponse)
  updateUserDetails(
    @CurrentUser() user,
    @Args("input") input: CreateUserDetailsInput,
    @CurrentLang() lang: string,
  ) {
    return this.userDetailsService.update(user._id, input, lang);
  }

  @Query(() => UserDetailsResponse)
  getUserDetails(@CurrentUser() user, @CurrentLang() lang: string) {
    return this.userDetailsService.findOne(user._id, lang);
  }

  @Mutation(() => UserDetails)
async setDriverOnlineStatus(
  @CurrentUser() user: { _id: string },
  @Args('isOnline') isDriverOnline: boolean,
): Promise<UserDetails> {
  return this.userDetailsService.setOnlineStatus(user._id, isDriverOnline);
}
}