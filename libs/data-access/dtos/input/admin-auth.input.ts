// libs/data-access/src/dto/admin/admin-auth.input.ts
import { Field, InputType } from "@nestjs/graphql";

@InputType()
export class AdminSignUpInput {
  @Field()
  fullName: string;

  @Field()
  email: string;

  @Field()
  password: string;
}

@InputType()
export class AdminSignInInput {
  @Field()
  email: string;

  @Field()
  password: string;
}

@InputType()
export class AdminForgotPasswordInput {
  @Field()
  email: string;
}

@InputType()
export class AdminVerifyOtpInput {
  @Field()
  email: string;

  @Field()
  otp: number;
}

@InputType()
export class AdminResetPasswordInput {
  @Field()
  email: string;

  @Field()
  newPassword: string;
}