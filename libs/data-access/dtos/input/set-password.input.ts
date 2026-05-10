import { Field, InputType } from "@nestjs/graphql";
import { Matches,MinLength,MaxLength,IsNotEmpty, IsEmail } from "class-validator";
import { passwordRegex } from "@libs/common/constants";
import { DeviceInput } from "./device.input";


@InputType()
export class SetPasswordInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @IsNotEmpty({ message: "USER.REQUIRED_PASSWORD" })
  @MinLength(8, { message: "USER.MIN_PASSWORD" })
  @MaxLength(20, { message: "USER.MAX_PASSWORD" })
  @Matches(passwordRegex, { message: "USER.INVALID_PASSWORD_INPUT" })
  password: string;

  @Field()
  @IsNotEmpty({ message: "USER.REQUIRED_PASSWORD" })
  @MinLength(8, { message: "USER.MIN_PASSWORD" })
  @MaxLength(20, { message: "USER.MAX_PASSWORD" })
  @Matches(passwordRegex, { message: "USER.INVALID_PASSWORD_INPUT" })
  confirmPassword: string;

  @Field(() => DeviceInput, { nullable: true })
  device?: DeviceInput;
}
