import { phoneRegex } from "@libs/common/constants";
import { verificationType } from "@libs/data-access";
import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsOptional, Matches } from "class-validator";
@InputType()
export class PhoneSignUpInput {
  @Field()
  @IsNotEmpty({ message: "USER.INVALID_PHONE" })
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;
}
