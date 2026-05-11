import { phoneRegex, userOtpSalt } from "@libs/common/constants";
import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, Length, Matches } from "class-validator";
import { DeviceInput } from "./device.input";

@InputType()
export class VerifyPhoneInput {
  @Field()
  @IsNotEmpty({ message: "USER.INVALID_PHONE" })
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;

  @Field()
  @Length(4, userOtpSalt.toString().length)
  @Matches(/^\d+$/, { message: "USER.INVALID_OTP" })
  otp: string;

 @Field(() => DeviceInput, { nullable: true })
  device?: DeviceInput;
}