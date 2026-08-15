import { InputType, Field } from "@nestjs/graphql";
import { IsString, IsNotEmpty } from "class-validator";

@InputType()
export class UpdateFirebaseTokenInput {
  @Field()
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @Field()
  @IsString()
  @IsNotEmpty()
  firebaseToken: string;

  @Field({ nullable: true })
  @IsString()
  deviceType?: string;
}
