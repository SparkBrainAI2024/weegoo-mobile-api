import { ObjectType, Field, ID } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "../base/base.entity";
import { TokenGrantType } from "../enums/token.enum";
import { roles } from "../enums/user.enum";

export type UserTokenMetaDocument = HydratedDocument<UserTokenMeta>;

@ObjectType()
@Schema({ timestamps: true })
export class UserTokenMeta extends BaseEntity {
  @Field(() => ID, {nullable: true })
  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  userId: Types.ObjectId;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: "AdminUser", default: null })
  adminId?: Types.ObjectId; 

  @Field()
  @Prop({ type: String, required: false })
  refreshTokenJti?: string;

  @Field()
  @Prop({ type: String, required: true })
  accessTokenJti: string;

  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  deviceId: string;

  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  firebaseToken: string;

  @Field(() => TokenGrantType)
  @Prop({ type: String, enum: TokenGrantType, default: TokenGrantType.REFRESH_TOKEN })
  grant: TokenGrantType;

  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  email?: string;

  @Field(() => roles, { nullable: true })
  @Prop({ type: String, enum: roles, default: roles.USER })
  role: string;
}

export const UserTokenMetaSchema = SchemaFactory.createForClass(UserTokenMeta);
export const userTokenMetaModel = {
  name: UserTokenMeta.name,
  schema: UserTokenMetaSchema,
};
