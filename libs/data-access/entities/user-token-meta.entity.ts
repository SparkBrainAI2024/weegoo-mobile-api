import { ObjectType, Field, ID } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "../base/base.entity";
import { TokenGrantType } from "../enums/token.enum";

export type UserTokenMetaDocument = HydratedDocument<UserTokenMeta>;

@ObjectType()
@Schema({ timestamps: true })
export class UserTokenMeta extends BaseEntity {
  @Field(() => ID)
  @Prop({ type: Types.ObjectId, ref: "User", required: true })
  userId: Types.ObjectId;

  @Field()
  @Prop({ type: String, required: false })
  refreshTokenJti?: string;

  @Field()
  @Prop({ type: String, required: true })
  accessTokenJti: string;

  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  deviceId: string;

  @Field(() => TokenGrantType)
  @Prop({ type: String, enum: TokenGrantType, default: TokenGrantType.REFRESH_TOKEN })
  grant: TokenGrantType;

  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  email?: string;
}

export const UserTokenMetaSchema = SchemaFactory.createForClass(UserTokenMeta);
export const userTokenMetaModel = {
  name: UserTokenMeta.name,
  schema: UserTokenMetaSchema,
};
