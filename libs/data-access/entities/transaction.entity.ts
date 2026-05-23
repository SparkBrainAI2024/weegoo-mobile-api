import { Field, Float, ObjectType, registerEnumType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { TransactionDirection, TransactionStatus, TransactionType } from "../enums/transaction.enum";
import { PaymentMethodEnum } from "../enums/payment.enum";









// ── Entity ─────────────────────────────────────────────────────────────────

@ObjectType()
@Schema({ timestamps: true })
export class Transaction extends BaseEntity {
  //TODO @Field(() => String, { nullable: true })
  // @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Wallet", default: null })
  // walletId?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Trip", default: null })
  tripId?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null })
  driverId?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "User", default: null })
  riderId?: string;

  @Field(() => TransactionDirection)
  @Prop({ required: true, type: String, enum: TransactionDirection, index: true })
  direction: TransactionDirection;

  @Field(() => TransactionType)
  @Prop({ required: true, type: String, enum: TransactionType, index: true })
  type: TransactionType;

  @Field(() => Float)
  @Prop({ required: true, type: Number })
  amount: number;

  @Field(() => PaymentMethodEnum, { nullable: true })
  @Prop({ type: String, enum: PaymentMethodEnum, default: null })
  paymentMethod?: PaymentMethodEnum;

  @Field(() => TransactionStatus)
  @Prop({
    required: true,
    type: String,
    enum: TransactionStatus,
    default: TransactionStatus.COMPLETED,
  })
  status: TransactionStatus;
}

export type TransactionDocument = HydratedDocument<Transaction>;
export const TransactionSchema = SchemaFactory.createForClass(Transaction);

export const transactionModel = {
  name: Transaction.name,
  schema: TransactionSchema,
};

// ── Compound indexes ───────────────────────────────────────────────────────

TransactionSchema.index({ walletId: 1, createdAt: -1 });
TransactionSchema.index({ tripId: 1 });
TransactionSchema.index({ driverId: 1, type: 1, createdAt: -1 });
TransactionSchema.index({ riderId: 1, type: 1, createdAt: -1 });
TransactionSchema.index({ type: 1, direction: 1, deleted: 1, deletedAt: 1 });