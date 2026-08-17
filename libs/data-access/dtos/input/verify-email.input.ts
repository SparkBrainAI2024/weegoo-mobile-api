import { Field, InputType } from "@nestjs/graphql";
import { Matches,Length,IsEmail} from "class-validator";

@InputType()
export class VerifyEmailInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @Length(4, 6)
  @Matches(/^\d+$/)
  otp: string;
}

@InputType()
export class VerifyEmailTokenInput {
  @Field()
  token: string;
}