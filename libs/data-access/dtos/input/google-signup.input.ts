import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty } from "class-validator";

@InputType()
export class GoogleSignUpInput {
  @Field()
  @IsNotEmpty()
  token: string;

  @Field({ nullable: true })
  deviceId?: string;

  @Field({ nullable: true })
  firebaseToken?: string;

  @Field({ nullable: true })
  deviceType?: string;
}