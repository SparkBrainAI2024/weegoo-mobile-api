import { Field, ObjectType, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../base/base.entity';

export type PromoCodeUsedDocument = PromoCodeUsed & HydratedDocument<PromoCodeUsed>;

@ObjectType()
@Schema({ timestamps: true })
export class PromoCodeUsed extends BaseEntity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'PromoCode', required: true, index: true })
  promoCodeId: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: 'Rides', required: true, index: true })
  rideId: Types.ObjectId;
}

export const PromoCodeUsedSchema = SchemaFactory.createForClass(PromoCodeUsed);

export const promoCodeUsedModel = {
  name: PromoCodeUsed.name,
  schema: PromoCodeUsedSchema,
};