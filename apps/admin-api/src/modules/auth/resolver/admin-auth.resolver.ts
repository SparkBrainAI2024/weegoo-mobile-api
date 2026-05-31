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

@Resolver()
export class AdminAuthResolver {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Mutation(() => AdminSignUpResponse)
  adminSignUp(@Args("input") input: AdminSignUpInput) {
    return this.adminAuthService.signup(
      input.fullName,
      input.email,
      input.password,
    );
  }

  @Mutation(() => AdminSignInResponse)
  adminSignIn(@Args("input") input: AdminSignInInput) {
    return this.adminAuthService.login(input.email, input.password);
  }

  @Mutation(() => BasicResponse)
  adminForgotPassword(@Args("input") input: AdminForgotPasswordInput) {
    return this.adminAuthService.forgotPassword(input.email);
  }

  @Mutation(() => AdminVerifyOTPResponse)
  adminVerifyOtp(@Args("input") input: AdminVerifyOtpInput) {
    return this.adminAuthService.verifyOtp(input.email, input.otp);
  }



@Mutation(() => BasicResponse)
adminResetPassword(@Args("input") input: AdminResetPasswordInput) {
  return this.adminAuthService.resetPassword(
    input.resetPasswordToken,  // ← update arg
    input.newPassword,
  );
}
}