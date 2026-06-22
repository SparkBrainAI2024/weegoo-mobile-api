import { Field, Float, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

@ObjectType()
@Schema({ timestamps: true, collection: 'wallets' })
export class Wallet extends BaseEntity {
  @Field(() => String)
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: string;

  @Field(() => Float)
  @Prop({ required: true, type: Number, default: 0, min: 0 })
  balance: number;
}

export type WalletDocument = HydratedDocument<Wallet>;
export const WalletSchema = SchemaFactory.createForClass(Wallet);

export const walletModel = {
  name: Wallet.name,
  schema: WalletSchema,
};