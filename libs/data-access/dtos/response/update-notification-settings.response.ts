import { Field, ObjectType, InputType } from '@nestjs/graphql';
import { NotificationSettings } from '../../common/notification-settings';

@ObjectType()
export class RoleNotificationSettings {
  @Field(() => String)
  role: string;

  @Field(() => NotificationSettings)
  settings: NotificationSettings;
}

@ObjectType()
export class UpdateNotificationSettingsResponse {
  @Field(() => String)
  role: string;

  @Field(() => Boolean)
  earnings: boolean;

  @Field(() => Boolean)
  appUpdates: boolean;

  @Field(() => Boolean)
  offersAndPromotion: boolean;

  @Field(() => Boolean)
  ridesUpdate: boolean;
}