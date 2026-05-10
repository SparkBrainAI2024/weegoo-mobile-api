import { Field, InputType } from "@nestjs/graphql";
import { Matches } from "class-validator";
import { phoneRegex } from "@libs/common/constants";

@InputType()
export class PhoneInput {
  @Field()
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;
}
