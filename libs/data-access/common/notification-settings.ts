import { Field, InputType, ObjectType } from '@nestjs/graphql';

@ObjectType()
@InputType('NotificationSettingsInput')
export class NotificationSettings {
  @Field(() => Boolean, { defaultValue: true })
  earnings: boolean;

  @Field(() => Boolean, { defaultValue: true })
  appUpdates: boolean;

  @Field(() => Boolean, { defaultValue: true })
  offersAndPromotion: boolean;

  @Field(() => Boolean, { defaultValue: true })
  ridesUpdate: boolean;
}