import { Resolver, Mutation, Query, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import {
  BasicResponse,
} from "@libs/data-access";
import { AuthGuard } from "@libs/guards/guard";
import { CurrentUser, CurrentLang } from "@libs/common";
import { ProfileService } from "../profile.service";

@Resolver()
@UseGuards(AuthGuard)
export class ProfileResolver {
  constructor(private readonly profileService: ProfileService) {}

  @Mutation(() => BasicResponse)
  deleteAccount(
    @CurrentUser() user,
    @CurrentLang() lang: string,
  ) {
    return this.profileService.deleteAccount(user._id, user.loginAs);
  }
}