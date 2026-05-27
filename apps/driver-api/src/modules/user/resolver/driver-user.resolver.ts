import { CurrentLang, CurrentUser } from "@libs/common";
import { CreateUserDetailsInput, DriverOnlineStatus, UserDetails, UserDetailsResponse } from "@libs/data-access";
import { AuthGuard, LangGuard } from "@libs/guards";
import { UserDetailsService } from "@libs/services/user/user.details.services";
import { UseGuards } from "@nestjs/common";
import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";


@Resolver(() => UserDetailsResponse)
@UseGuards(AuthGuard, LangGuard)
export class DriverUserResolver {
  constructor(
    private readonly userDetailsService: UserDetailsService){}
  

  @Mutation(() => UserDetails)
async setDriverOnlineStatus(
  @CurrentUser() user,
  @Args('onlineStatus') driverOnlineStatus: DriverOnlineStatus,
): Promise<UserDetails> {
  return this.userDetailsService.setOnlineStatus(user._id, driverOnlineStatus);
}

}