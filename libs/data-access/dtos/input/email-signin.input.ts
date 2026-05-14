import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsNotEmpty, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { DeviceInput } from "./device.input";

@InputType()
export class EmailSignInInput {
  @Field()
  @IsEmail({}, { message: "USER.INVALID_EMAIL" })
  email: string;

  @Field()
  @IsNotEmpty()
  password: string;

  @Field(() => DeviceInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInput)
  device?: DeviceInput;
}