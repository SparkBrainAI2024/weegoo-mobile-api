import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { GeoLocation } from "../common/geo.location";
import { GenderEnum, ridePreference } from "../enums/user.enum";
import { BaseEntity } from "../base/base.entity";

export type UserDetailsDocument = UserDetails &
  HydratedDocument<UserDetails>;

@ObjectType()
@Schema({ timestamps: true })
export class UserDetails extends BaseEntity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, index: true, ref: "User" })
  userId: Types.ObjectId;

  @Field()
  @Prop({ required: false, type: String })
  fullName?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  address?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  profileImage?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: Date, default: null })
  dateOfBirth?: Date;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  bio?: string;

  @Field(() => GeoLocation, { nullable: true })
  @Prop({ required: false, type: Object, default: {} })
  geoLocation?: GeoLocation;

  @Field(() => GenderEnum, { defaultValue: GenderEnum.UNPUBLISHED })
  @Prop({
    type: String,
    enum: GenderEnum,
    default: GenderEnum.UNPUBLISHED,
  })
  gender?: string;

  @Field(() => ridePreference, { defaultValue: ridePreference.SCHEDULED })
  @Prop({
    type: String,
    enum: ridePreference,
    default: ridePreference.BOTH,
  })
  ridePreference?: string
}
export const UserDetailsSchema = SchemaFactory.createForClass(UserDetails);

export const userDetailModel = {
  name: UserDetails.name,
  schema: UserDetailsSchema,
};

