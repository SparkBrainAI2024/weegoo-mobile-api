import { CurrentLang, CurrentUser } from "@libs/common";
import {
  BasicResponse,
  CreateUserDetailsInput,
  UserDetailsResponse,
} from "@libs/data-access";
import {
  ChangeAdminPasswordInput,
  UpdateAdminProfileInput,
} from "@libs/data-access/dtos/input/update-admin-profile.input";
import { AdminProfileResponse } from "@libs/data-access/dtos/response/admin-profile.response";
import { AdminUserDocument } from "@libs/data-access/entities/admin-user.entity";
import { AuthGuard, LangGuard } from "@libs/guards";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { AdminProfileService } from "@libs/services/admin-profile/admin-profile.service";
import { UserDetailsService } from "@libs/services/user/user.details.services";
import { UseGuards } from "@nestjs/common";
import { Resolver, Query, Mutation, Args } from "@nestjs/graphql";

@Resolver(() => UserDetailsResponse)
@UseGuards(AdminAuthGuard, LangGuard)
export class UserDetailsResolver {
  constructor(
    private readonly userDetailsService: UserDetailsService,
    private readonly adminProfileService: AdminProfileService,
  ) {}

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

  @Query(() => AdminProfileResponse, { name: "getAdminProfile" })
  getAdminProfile(@CurrentUser() admin: AdminUserDocument) {
    return this.adminProfileService.getProfile(admin);
  }

  @Mutation(() => AdminProfileResponse)
  updateAdminProfile(
    @CurrentUser() admin: AdminUserDocument,
    @Args("input") input: UpdateAdminProfileInput,
  ) {
    return this.adminProfileService.updateProfile(admin._id, input);
  }

  @Mutation(() => BasicResponse)
  changeAdminPassword(
    @CurrentUser() admin: AdminUserDocument,
    @Args("input") input: ChangeAdminPasswordInput,
    @CurrentLang() lang: string,
  ) {
    return this.adminProfileService.changePassword(admin, input, lang);
  }
}
