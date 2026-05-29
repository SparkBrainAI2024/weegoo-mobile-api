// libs/data-access/src/dto/admin-auth.dto.ts
import { Field, InputType, ObjectType } from "@nestjs/graphql";
import { IsEmail, IsNotEmpty, IsNumber, MinLength } from "class-validator";

// --- Inputs ---



@InputType()
export class CreateAdminInput {
  @Field()
  @IsNotEmpty()
  fullName: string;

  @Field()
  @IsEmail({}, { message: "ADMIN.INVALID_EMAIL" })
  email: string;

  @Field()
  @IsNotEmpty()
  @MinLength(8, { message: "ADMIN.PASSWORD_TOO_SHORT" })
  password: string;
}

@InputType()
export class AdminForgotPasswordInput {
  @Field()
  @IsEmail({}, { message: "ADMIN.INVALID_EMAIL" })
  email: string;
}

@InputType()
export class AdminVerifyOtpInput {
  @Field()
  @IsEmail({}, { message: "ADMIN.INVALID_EMAIL" })
  email: string;

  @Field()
  @IsNumber()
  otp: number;
}

@InputType()
export class AdminUpdatePasswordInput {
  @Field()
  @IsEmail({}, { message: "ADMIN.INVALID_EMAIL" })
  email: string;

  @Field()
  @IsNumber()
  otp: number;

  @Field()
  @IsNotEmpty()
  @MinLength(8, { message: "ADMIN.PASSWORD_TOO_SHORT" })
  newPassword: string;
}

@InputType()
export class AdminSignInInput {
  @Field()
  @IsEmail({}, { message: "ADMIN.INVALID_EMAIL" })
  email: string;

  @Field()
  @IsNotEmpty()
  password: string;
}

// --- Responses ---

@ObjectType()
export class AdminForgotPasswordResponse {
  @Field()
  message: string;

  @Field()
  expiresIn: number; // seconds remaining
}

@ObjectType()
export class AdminVerifyOtpResponse {
  @Field()
  message: string;

  @Field()
  otpVerified: boolean;
}

@ObjectType()
export class AdminUpdatePasswordResponse {
  @Field()
  message: string;
}

@ObjectType()
export class AdminSignInResponse {
  @Field()
  message: string;

  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;
}