import { Notification } from "@libs/data-access/entities/notification.entity";
import { Field, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class NotificationGroup {
  @Field()
  title: string;

  @Field(() => [Notification])
  notifications: Notification[];
}