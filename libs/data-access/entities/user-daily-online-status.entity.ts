import { Field, ID, ObjectType, Int } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../base/base.entity';

export type UserDailyOnlineStatusDocument = UserDailyOnlineStatus & HydratedDocument<UserDailyOnlineStatus>;

@ObjectType()
@Schema({ timestamps: true })
export class UserDailyOnlineStatus extends BaseEntity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, required: true, index: true, ref: 'UserDetails' })
  userId: Types.ObjectId;

  @Field(() => String)
  @Prop({ type: String, required: true })
  date: string; // Format: 'YYYY-MM-DD'

  @Field(() => Int)
  @Prop({ type: Number, required: true, default: 0 })
  totalOnlineSeconds: number; // Accumulated online seconds for the day

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, default: null })
  lastOnlineAt?: Date; // Timestamp when user last came online (null if offline)
}

export const UserDailyOnlineStatusSchema = SchemaFactory.createForClass(UserDailyOnlineStatus);

// Compound index to ensure one record per user per day
UserDailyOnlineStatusSchema.index({ userId: 1, date: 1 }, { unique: true });

export const userDailyOnlineStatusModel = {
  name: UserDailyOnlineStatus.name,
  schema: UserDailyOnlineStatusSchema,
};