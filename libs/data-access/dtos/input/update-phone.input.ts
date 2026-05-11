import { phoneRegex } from "@libs/common/constants";
import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsNotEmpty, Matches } from "class-validator";

@InputType()
export class UpdatePhoneInput {
  @Field()
  @IsNotEmpty({ message: "USER.INVALID_PHONE" })
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;

   @Field()
    @IsEmail()
    email: string;
}
