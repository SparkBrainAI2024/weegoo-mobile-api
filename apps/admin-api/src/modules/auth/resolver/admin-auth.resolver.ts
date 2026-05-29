// apps/admin/src/auth/admin-auth.resolver.ts
import { Resolver, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AuthGuard, LangGuard } from "@libs/guards/guard";
import { CurrentLang } from "@libs/common";
import { AdminAuthService } from "../admin-auth.service";
import {
  AdminForgotPasswordInput,
  AdminVerifyOtpInput,
  AdminUpdatePasswordInput,
  AdminSignInInput,
  AdminForgotPasswordResponse,
  AdminVerifyOtpResponse,
  AdminUpdatePasswordResponse,
  AdminSignInResponse,
  CreateAdminInput,
} from "../dto/admin-auth.input";
import { CreateAdminResponse } from "../dto/admin-auth.response";

@Resolver()
@UseGuards(LangGuard)
export class AdminAuthResolver {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Mutation(() => AdminSignInResponse)
  adminSignIn(
    @Args("input") input: AdminSignInInput,
    @CurrentLang() lang: string,
  ) {
    return this.adminAuthService.signIn(input, lang);
  }

  @Mutation(() => AdminForgotPasswordResponse)
  adminForgotPassword(
    @Args("input") input: AdminForgotPasswordInput,
    @CurrentLang() lang: string,
  ) {
    return this.adminAuthService.forgotPassword(input, lang);
  }

  @Mutation(() => AdminVerifyOtpResponse)
  adminVerifyOtp(
    @Args("input") input: AdminVerifyOtpInput,
    @CurrentLang() lang: string,
  ) {
    return this.adminAuthService.verifyOtp(input, lang);
  }

  @Mutation(() => AdminUpdatePasswordResponse)
  adminUpdatePassword(
    @Args("input") input: AdminUpdatePasswordInput,
    @CurrentLang() lang: string,
  ) {
    return this.adminAuthService.updatePassword(input, lang);
  }

  // add to admin-auth.resolver.ts — protected by AdminGuard

@UseGuards(AuthGuard)  // only existing admins can create new admins
@Mutation(() => CreateAdminResponse)
createAdmin(
  @Args("input") input: CreateAdminInput,
  @CurrentLang() lang: string,
) {
  return this.adminAuthService.createAdmin(input, lang);
}
}