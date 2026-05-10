import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsNotEmpty } from "class-validator";
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
  device?: DeviceInput;
}