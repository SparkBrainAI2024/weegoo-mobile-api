import { Field, InputType } from "@nestjs/graphql";
import { IsNotEmpty } from "class-validator";
import { DeviceInput } from "./device.input";

@InputType()
export class GoogleSignInInput {
  @Field()
  @IsNotEmpty()
  token: string;

  @Field(() => DeviceInput, { nullable: true })
  device?: DeviceInput;
}