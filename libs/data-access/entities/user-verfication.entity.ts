import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { verificationType } from "../enums/user.enum";
import { HydratedDocument, Types } from "mongoose";
import { userOtpExpiredTime } from "@libs/common/constants";
import { Field, ID, ObjectType } from "@nestjs/graphql";
import { BaseEntity } from "../base/base.entity";

export type UserVerificationDocument = HydratedDocument<UserVerification>;

@ObjectType()
@Schema({ timestamps: true })
export class UserVerification extends BaseEntity {
   @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: "User", default: null })
  userId?: Types.ObjectId;

  @Field(() => ID, { nullable: true })
  @Prop({ type: Types.ObjectId, ref: "AdminUser", default: null })
  adminId?: Types.ObjectId;

  @Field()
  @Prop({ type: Number })
  otp: number;

  @Field(() => verificationType)
  @Prop({
    type: String,
    enum: verificationType,
    default: verificationType.VERIFICATION_PHONE,
  })
  type: string;
}

export const UserVerificationSchema =
  SchemaFactory.createForClass(UserVerification);
export const userVerificationModel = {
  name: UserVerification.name,
  schema: UserVerificationSchema,
};
UserVerificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: userOtpExpiredTime },
);
