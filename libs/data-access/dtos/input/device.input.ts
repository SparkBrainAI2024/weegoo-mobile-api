import { Field, InputType } from "@nestjs/graphql";
import { IsOptional, IsString } from "class-validator";
@InputType()
export class DeviceInput {
  @Field()
  @IsString()
  deviceId: string;

  @Field({ defaultValue:'UNKNOWN',nullable:true })
  @IsOptional()
  firebaseToken?: string;

  @Field()
  @IsString()
  deviceType: string;
}
