import { Field, ObjectType } from "@nestjs/graphql";
import { AuthProvider, language, roles, UserStatus } from "../enums/user.enum";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { BaseEntity } from "../base/base.entity";
import { HydratedDocument } from "mongoose";

@ObjectType()
@Schema({ timestamps: true })
export class User extends BaseEntity {
  @Prop({ type: String })
  @Field(() => String)
  fullName: string;

  @Prop({ required: true, type: String, enum: AuthProvider, index: true,default: AuthProvider.PHONE })
  @Field(() => AuthProvider)
  authProvider: AuthProvider;

  @Prop({ required: false, type: String, index: true })
  @Field(() => String)
  authProviderId?: string;

  @Prop({ required: false, type: String })
  password: string;

  @Prop({ required: false, unique: true, sparse: true, type: String })
  @Field(() => String)
  email?: string;

  @Prop({ required: true, type: String, enum: UserStatus, default: UserStatus.INACTIVE })
  @Field(() => UserStatus)
  status: UserStatus;

  @Prop({ type: Date, default: null })
  lastResetLinkSentAt?: Date;

  @Prop({ type: Number, default: 0 })
  invalidLoginAttempts: number;

  @Field({ defaultValue: false })
  @Prop({ default: false })
  profileCompleted: boolean;

  @Field({ defaultValue: false })
  @Prop({ default: false })
  suspended: boolean;

  @Field({ defaultValue: false })
  @Prop({ default: false })
  verified: boolean;

  @Field({ nullable: true })
  @Prop({ default: null })
  lastLogin?: Date;

  @Field(()=>String, { nullable: true })
  @Prop({ required: false, unique: true,sparse:true, type: String })
  phone?: string;

  @Field(() => language, { defaultValue: language.EN })
  @Prop({ type: String, enum: language, default: language.EN })
  language: string;

  @Field(() => [roles], { defaultValue: [roles.USER] })
  @Prop({ type: [String], enum: roles, default: [roles.USER] })
  roles: string[];

  @Field(() => roles, { defaultValue: roles.USER })
  @Prop({ type: String, enum: roles, default: roles.USER })
  loginAs: string;
}
export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);

export const userModel = {
  name: User.name,
  schema: UserSchema,
};

UserSchema.index({ authProvider: 1, deleted: 1, deletedAt: 1 });