import { Field, InputType, registerEnumType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";

export enum PushNotificationTarget {
  USER = "USER",
  DRIVER = "DRIVER",
  ALL = "ALL",
}

registerEnumType(PushNotificationTarget, {
  name: "PushNotificationTarget",
  description: "Target audience for the push notification",
});

@InputType()
export class SendPushNotificationInput {
  @Field(() => PushNotificationTarget)
  @IsEnum(PushNotificationTarget)
  @IsNotEmpty()
  target: PushNotificationTarget;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  title: string;

  @Field(() => String)
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  message: string;
}