import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";

@InputType()
export class GoogleSignUpInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty({ message: "Token is required" })
  token: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  firebaseToken?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  deviceType?: string;
}