import { phoneRegex } from "@libs/common/constants";
import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, Matches } from "class-validator";
import { DeviceInput } from "./device.input";

@InputType()
export class PhoneSignInInput {
  @Field()
  @IsNotEmpty({ message: "USER.INVALID_PHONE" })
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;

  @Field(() => DeviceInput, { nullable: true })
  device?: DeviceInput;
}