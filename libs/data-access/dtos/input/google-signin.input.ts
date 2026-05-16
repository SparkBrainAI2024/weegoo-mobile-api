import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty, IsOptional, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { DeviceInput } from "./device.input";

@InputType()
export class GoogleSignInInput {
  @Field()
  @IsNotEmpty()
  token: string;

  @Field(() => DeviceInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInput)
  device?: DeviceInput;
}