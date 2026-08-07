import { Field, InputType } from "@nestjs/graphql";
import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";

@InputType()
export class UpsertAdminCompanyInfoInput {
  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  companyName: string;

  @Field(() => String)
  @IsEmail()
  @IsNotEmpty()
  supportEmail: string;
}