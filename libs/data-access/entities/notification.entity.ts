import { Field, ObjectType } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes } from 'mongoose';
import { BaseEntity } from '../base/base.entity';
import { NotificationType } from '../enums/notification.enum';
import { roles } from '../enums/user.enum';

@ObjectType()
@Schema({ timestamps: true })
export class Notification extends BaseEntity {
  @Prop({
    required: true,
    ref: 'User',
    type: SchemaTypes.ObjectId,
  })
  userId: string;

  @Prop({ required: true, type: String, enum: roles })
  roles: string;

  @Field(() => String)
  @Prop({ required: true, type: String })
  title: string;

  @Field(() => NotificationType)
  @Prop({ type: String, enum: NotificationType, required: true })
  notificationType: NotificationType;

  @Field(() => String)
  @Prop({type:String, required: true})
  description: string;

  @Field(() => Date, { nullable: true })
  @Prop({type:Date, default:null})
  readAt: Date;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  viewedAt: Date;

  @Field(() => Boolean)
  @Prop({ type: Boolean, default: false })
  isOpen: boolean;
}

export type NotificationDocument = HydratedDocument<Notification>;

export const NotificationSchema =
  SchemaFactory.createForClass(Notification);

export const notificationModel = {
  name: Notification.name,
  schema: NotificationSchema,
};