import { Optional } from "@nestjs/common";
import { Field, InputType } from "@nestjs/graphql";
@InputType()
export class DeviceInput {
  @Field()
  @Optional()
  deviceId?: string;

  @Field()
  @Optional()
  firebaseToken?: string;

  @Field()
   @Optional()
  deviceType?: string;
}
