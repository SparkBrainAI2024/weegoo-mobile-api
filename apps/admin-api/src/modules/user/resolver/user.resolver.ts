import { Resolver, Mutation, Query, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import {
  ChangeLanguageInput,
  ChangePasswordInput,
  LogOutInput,
  VerifyEmailInput,
  UserDetailEntity,
  BasicResponse
} from "@libs/data-access";
import { AuthGuard } from "@libs/guards/guard";
import { CurrentLang, CurrentUser } from "@libs/common";
import { UserService } from "@libs/services/user/user.service";


@Resolver()
@UseGuards(AuthGuard)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(() => BasicResponse)
  logOut(
    @Args("input") input: LogOutInput,
    @CurrentUser() user,
    @CurrentLang() lang: string,
  ) {
    return this.userService.logOut(input.deviceId, user._id, lang);
  }

  @Mutation(() => BasicResponse)
  changePassword(
    @Args("input") input: ChangePasswordInput,
    @CurrentUser() user,
    @CurrentLang() lang: string,
  ) {
    return this.userService.changePassword(input, user._id, lang);
  }

  @Mutation(() => BasicResponse)
  changeLanguage(
    @Args("input") input: ChangeLanguageInput,
    @CurrentUser() user,
  ) {
    return this.userService.changeLanguage(input.language, user._id);
  }

  @Mutation(() => BasicResponse)
  verifyChangeEmailOTP(
    @Args("input") input: VerifyEmailInput,
    @CurrentUser() user,
    @CurrentLang() lang: string,
  ) {
    return this.userService.verifyChangeEmailOTP(input, lang, user._id);
  }

  @Query(() => UserDetailEntity)
  getUser(@CurrentUser() user) {
    return this.userService.getUserById(user._id);
  }
}
