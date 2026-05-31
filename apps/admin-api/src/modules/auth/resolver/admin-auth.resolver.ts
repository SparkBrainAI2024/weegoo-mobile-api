// apps/admin/src/auth/resolver/admin-auth.resolver.ts
import { Resolver, Mutation, Args } from "@nestjs/graphql";
import {
AdminSignUpInput,
AdminSignInInput,
AdminForgotPasswordInput,
AdminVerifyOtpInput,
AdminResetPasswordInput,
} from "@libs/data-access/dtos/input/admin-auth.input";
import {
AdminSignInResponse,
AdminSignUpResponse,
AdminVerifyOTPResponse,
} from "@libs/data-access/dtos/response/admin-auth.response";
import { BasicResponse } from "@libs/data-access";
import { AdminAuthService } from "@libs/services/admin-auth";
import { CurrentLang } from "@libs/common";
@Resolver()
export class AdminAuthResolver {
constructor(private readonly adminAuthService: AdminAuthService) {}



@Mutation(() => AdminSignUpResponse)
adminSignUp(@Args("input") input: AdminSignUpInput, @CurrentLang() lang: string) {
  return this.adminAuthService.signup(input.fullName, input.email, input.password, lang);
}

@Mutation(() => AdminSignInResponse)
adminSignIn(@Args("input") input: AdminSignInInput, @CurrentLang() lang: string) {
  return this.adminAuthService.login(input.email, input.password, lang);
}

@Mutation(() => BasicResponse)
adminForgotPassword(@Args("input") input: AdminForgotPasswordInput, @CurrentLang() lang: string) {
  return this.adminAuthService.forgotPassword(input.email, lang);
}

@Mutation(() => AdminVerifyOTPResponse)
adminVerifyOtp(@Args("input") input: AdminVerifyOtpInput, @CurrentLang() lang: string) {
  return this.adminAuthService.verifyOtp(input.email, input.otp, lang);
}

@Mutation(() => BasicResponse)
adminResetPassword(@Args("input") input: AdminResetPasswordInput, @CurrentLang() lang: string) {
  return this.adminAuthService.resetPassword(input.resetPasswordToken, input.newPassword, lang);
}
}