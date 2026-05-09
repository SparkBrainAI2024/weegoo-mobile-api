import { Resolver, Mutation, Args } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { LangGuard } from "@libs/guards/guard";
import { CurrentLang } from "@libs/common";
import { AuthService } from "@libs/services/auth";
import {
  SignInResponse,
  SignUpResponse,
  VerifyResetPasswordOtpResponse,
  RefreshTokenInput,
  ResetPasswordInput,
  EmailInput,
  SetPasswordInput,
  EmailSignInInput,
  EmailSignUpInput,
  VerifyEmailInput,
  BasicResponse,
  GoogleSignInInput,
  GoogleSignUpInput,
  PhoneSignUpInput,
  PhoneSignInInput,
  VerifyPhoneInput,
} from "@libs/data-access";

@Resolver()
@UseGuards(LangGuard)
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(() => SignUpResponse)
  signUp(@Args("input") input: EmailSignUpInput, @CurrentLang() lang: string) {
    return this.authService.signup(input, lang);
  }

  @Mutation(() => SignInResponse)
  setPassword(
    @Args("input") input: SetPasswordInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.setPassword(input, lang);
  }

  @Mutation(() => BasicResponse)
  verifyEmail(
    @Args("input") input: VerifyEmailInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.verifyEmail(input, lang);
  }

  @Mutation(() => SignInResponse)
  async signIn(@Args("input") input: EmailSignInInput) {
    return this.authService.signIn(input);
  }

  @Mutation(() => SignInResponse)
  loginWithRefreshToken(@Args("input") input: RefreshTokenInput) {
    return this.authService.loginWithRefreshToken(input.refreshToken);
  }

  @Mutation(() => BasicResponse)
  sendVerifyEmailOtp(
    @Args("input") input: EmailInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.sendVerifyEmailOtp(input, lang);
  }

  @Mutation(() => VerifyResetPasswordOtpResponse)
  verifyResetPasswordOtp(
    @Args("input") input: VerifyEmailInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.verifyResetPasswordOTP(input, lang);
  }

  @Mutation(() => BasicResponse)
  resetPassword(
    @Args("input") input: ResetPasswordInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.resetPassword(input, lang);
  }

  @Mutation(() => SignInResponse)
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

  @Mutation(() => BasicResponse)
  verifyPhone(
    @Args("input") input: VerifyPhoneInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.verifyPhone(input, lang);
  }

  @Mutation(() => VerifyResetPasswordOtpResponse)
  verifyResetPasswordPhoneOtp(
    @Args("input") input: VerifyPhoneInput,
    @CurrentLang() lang: string,
  ) {
    return this.authService.verifyResetPasswordPhoneOTP(input, lang);
  }
}
