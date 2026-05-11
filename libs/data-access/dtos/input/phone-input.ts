import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsOptional, Matches } from "class-validator";
import { phoneRegex } from "@libs/common/constants";
import { verificationType } from "../../enums/user.enum";

@InputType()
export class PhoneInput {
  @Field()
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;

  @Field(() => verificationType, { nullable: true })
  @IsOptional()
  @IsEnum(verificationType)
  type?: verificationType;
}
