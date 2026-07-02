import { Field, InputType } from "@nestjs/graphql";
@InputType()
export class DeviceInput {
  @Field({ nullable: true })
  deviceId?: string;

  @Field({ nullable: true })
  firebaseToken?: string;

  @Field({ nullable: true })
  deviceType?: string;
}
