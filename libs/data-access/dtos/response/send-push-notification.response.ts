import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class SendPushNotificationResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => Number)
  notifiedCount: number;
}