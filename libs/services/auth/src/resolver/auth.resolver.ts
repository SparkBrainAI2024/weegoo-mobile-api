import { Resolver, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { LangGuard } from "@libs/guards/guard";
import { SetPasswordGuard } from "@libs/guards/set-password.guard";
import {
  CurrentLang,
  CurrentVerificationUser,
  CurrentVerificationTokenData,
} from "@libs/common";
import { AuthService } from "../auth.service";
import { UserService } from "@libs/services/user/user.service";
import {
  SignInResponse,
  SignUpResponse,
  SetPasswordResponse,
  SetPasswordInput,
  VerifyGooglePhoneResponse,
  VerifyResetPasswordOtpResponse,
  RefreshTokenInput,
  ResetPasswordInput,
  // EmailInput,
  PhoneInput,
  // VerifyEmailInput,
  BasicResponse,
  GoogleSignInInput,
  GoogleSignUpInput,
  PhoneSignUpInput,
  PhoneSignInInput,
  VerifyPhoneInput,
  UpdatePhoneInput,
  BasicExpirationResponse,
} from "@libs/data-access";

@Resolver()
@UseGuards(LangGuard)
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) { }

  // @Mutation(() => SignInResponse)
  // verifyEmail(
  //   @Args("input") input: VerifyEmailInput,
  //   @CurrentLang() lang: string,
  // ) {
  //   return this.authService.verifyEmail(input, lang);
  // }

  @Mutation(() => SignInResponse)
  loginWithRefreshToken(@Args("input") input: RefreshTokenInput) {
    return this.authService.loginWithRefreshToken(input.refreshToken);
  }

  // @Mutation(() => BasicResponse)
  // sendVerifyEmailOtp(
  //   @Args("input") input: EmailInput,
  //   @CurrentLang() lang: string,
  // ) {
  //   return this.authService.sendVerifyEmailOtp(input, lang);
  // }

  @Mutation(() => BasicExpirationResponse)
  sendVerifyPhoneOtp(
    @Args("input") input: PhoneInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.sendVerifyPhoneOtp(input, lang);
  }

  // @Mutation(() => VerifyResetPasswordOtpResponse)
  // verifyResetPasswordOtp(
  //   @Args("input") input: VerifyEmailInput,
  //   @CurrentLang() lang: string,
  // ) {
  //   return this.authService.verifyResetPasswordOTP(input, lang);
  // }

  @Mutation(() => BasicResponse)
  resetPassword(
    @Args("input") input: ResetPasswordInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.resetPassword(input, lang);
  }

  @Mutation(() => BasicResponse)
  googleSignUp(@Args("input") input: GoogleSignUpInput, @CurrentLang() lang: string) {
    return this.authService.googleSignUp(input, lang);
  }

  @Mutation(() => SignInResponse)
  googleSignIn(@Args("input") input: GoogleSignInInput) {
    return this.authService.googleSignIn(input);
  }

  @Mutation(() => SignUpResponse)
  phoneSignUp(
    @Args("input") input: PhoneSignUpInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.phoneSignUp(input, lang);
  }

  @Mutation(() => SignInResponse)
  phoneSignIn(
    @Args("input") input: PhoneSignInInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.phoneSignIn(input, lang);
  }

  @Mutation(() => SignUpResponse)
  verifyPhone(
    @Args("input") input: VerifyPhoneInput,
    @CurrentLang() lang: string,
  ) {
    console.log("input", input);
    return this.authService.verifyPhone(input, lang);
  }

  @Mutation(() => VerifyGooglePhoneResponse)
  verifyGooglePhone(
    @Args("input") input: VerifyPhoneInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.verifyGooglePhone(input, lang);
  }

  @UseGuards(SetPasswordGuard)
  @Mutation(() => SetPasswordResponse)
  setPassword(
    @Args("input") input: SetPasswordInput,
    @CurrentVerificationUser() user: any,
    @CurrentVerificationTokenData() verificationTokenData: any,
    @CurrentLang() lang: string,
  ) {
    return this.authService.setPassword(input, user, lang, verificationTokenData);
  }

  @Mutation(() => VerifyResetPasswordOtpResponse)
  verifyResetPasswordPhoneOtp(
    @Args("input") input: VerifyPhoneInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.verifyResetPasswordPhoneOTP(input, lang);
  }

  @Mutation(() => BasicExpirationResponse)
  updatePhone(
    @Args("input") input: UpdatePhoneInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.updatePhone(input, lang);
  }
}
