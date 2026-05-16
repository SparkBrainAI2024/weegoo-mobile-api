import { phoneRegex } from "@libs/common/constants";
import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, Matches, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { DeviceInput } from "./device.input";

@InputType()
export class PhoneSignInInput {
  @Field()
  @IsNotEmpty({ message: "USER.INVALID_PHONE" })
  @Matches(phoneRegex, {
    message: "USER.INVALID_PHONE",
  })
  phone: string;
  
  @Field()
  @IsNotEmpty()
  password: string;

  @Field(() => DeviceInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInput)
  device?: DeviceInput;
}