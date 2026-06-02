import { Field, ObjectType, ID } from '@nestjs/graphql';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { BaseEntity } from '../base/base.entity';
import { DiscountTypeEnum, AppliedToEnum, PromoCodeStatusEnum } from '../enums/promo-code.enum';

@ObjectType()
export class Occasion {
  @Field(() => String)
  @Prop({ type: String, required: true })
  type: string; // e.g., 'HOLIDAY', 'EVENT'

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, required: true })
  occasionId: Types.ObjectId; // e.g., ID of a specific holiday or event
}

export type PromoCodeDocument = PromoCode & HydratedDocument<PromoCode>;

@ObjectType()
@Schema({ timestamps: true })
export class PromoCode extends BaseEntity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => Occasion, { nullable: true })
  @Prop({ type: Occasion, required: false })
  occasion?: Occasion;

  @Field(() => String)
  @Prop({ type: String, required: true, unique: true, trim: true })
  name: string; // e.g., "SUMMER20", "FIRST_RIDE"

  @Field(() => DiscountTypeEnum)
  @Prop({ type: String, enum: DiscountTypeEnum, required: true })
  discountType: DiscountTypeEnum;

  @Field(() => Number, { nullable: true })
  @Prop({ type: Number, required: false, default: 0 })
  percentageAmount?: number; // For PERCENTAGE type, e.g., 20 for 20%

  @Field(() => Number, { nullable: true })
  @Prop({ type: Number, required: false, default: 0 })
  flatAmount?: number; // For FLAT type, e.g., 50 for $50 off

  @Field(() => Number, { nullable: true })
  @Prop({ type: Number, required: false, default: 0 })
  maxDiscount?: number; // Maximum discount for percentage-based codes

  @Field(() => Number, { nullable: true })
  @Prop({ type: Number, required: false, default: 0 })
  minimumFare?: number; // Minimum fare required to apply the promo code

  @Field(() => AppliedToEnum)
  @Prop({ type: String, enum: AppliedToEnum, required: true, default: AppliedToEnum.ALL_RIDES })
  appliedTo: AppliedToEnum; // To which ride types the promo code applies

  @Field(() => Number)
  @Prop({ type: Number, required: true, default: 1 })
  totalUsageLimit: number; // Total number of times this promo code can be used across all users

  @Field(() => Number)
  @Prop({ type: Number, required: true, default: 1 })
  perUserLimit: number; // Number of times a single user can use this promo code

  @Field(() => Date)
  @Prop({ type: Date, required: true })
  startDateTime: Date;

  @Field(() => Date)
  @Prop({ type: Date, required: true })
  expiryDateTime: Date;

  @Field(() => PromoCodeStatusEnum)
  @Prop({ type: String, enum: PromoCodeStatusEnum, required: true, default: PromoCodeStatusEnum.ACTIVE })
  status: PromoCodeStatusEnum;
}

export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);

export const promoCodeModel = {
  name: PromoCode.name,
  schema: PromoCodeSchema,
};