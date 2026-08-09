import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { GeoLocation } from "../common/geo.location";
import { SavedLocation } from "../common/saved-location";
import { RecentPlace } from "../common/recent-place";
import { NotificationSettings } from "../common/notification-settings";
import { GraphQLJSON } from "graphql-scalars";
import {
  GenderEnum,
  ridePreference,
  ProvinceEnum,
  DriverOnlineStatus,
} from "../enums/user.enum";
import { BaseEntity } from "../base/base.entity";
import { UserProfileImageEntity } from "../common/user-profile-image";

export type UserDetailsDocument = UserDetails & HydratedDocument<UserDetails>;

@ObjectType()
@Schema({ timestamps: true })
export class UserDetails extends BaseEntity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, index: true, ref: "User" })
  userId: Types.ObjectId;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  fullName?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  address?: string;

  @Field(() => [UserProfileImageEntity])
  @Prop({ type: [UserProfileImageEntity], default: [] })
  profileImages: UserProfileImageEntity[];

  @Field({ nullable: true })
  @Prop({ required: false, type: Date, default: null })
  dateOfBirth?: Date;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  bio?: string;

  @Field(() => GeoLocation, { nullable: true })
  @Prop({ required: false, type: Object, default: null })
  geoLocation?: GeoLocation;

  @Field(() => GenderEnum, { defaultValue: GenderEnum.UNPUBLISHED })
  @Prop({
    type: String,
    enum: GenderEnum,
    default: GenderEnum.UNPUBLISHED,
  })
  gender?: GenderEnum;

  @Field(() => ridePreference, { defaultValue: ridePreference.BOTH })
  @Prop({
    type: String,
    enum: ridePreference,
    default: ridePreference.BOTH,
  })
  ridePreference?: string;

  @Field(() => DriverOnlineStatus, { nullable: true })
  @Prop({ type: String, enum: DriverOnlineStatus, default: null })
  driverOnlineStatus?: DriverOnlineStatus;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  district?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  streetName?: string;

  @Field(() => ProvinceEnum, { nullable: true })
  @Prop({
    type: String,
    enum: ProvinceEnum,
    required: false,
  })
  province?: string;

  @Field({ nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, defaultValue: 0 })
  rating?: number;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  citizenshipNumber?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: String })
  locationChannelId?: string;

  @Field(() => SavedLocation, { nullable: true })
  @Prop({ required: false, type: Object, default: null })
  homeLocation?: SavedLocation;

  @Field(() => SavedLocation, { nullable: true })
  @Prop({ required: false, type: Object, default: null })
  workLocation?: SavedLocation;

  @Field(() => [RecentPlace], { nullable: true })
  @Prop({ required: false, type: [Object], default: [] })
  recentPlaces?: RecentPlace[];

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, default: 0 })
  walletAmount?: number;

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, default: 0 })
  amountDueToCompany?: number;

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, default: 0 })
  totalEarnings?: number;

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, default: 0 })
  totalTripsAsPassenger?: number;

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, default: 0 })
  totalSpendingOnRides?: number;

  @Field(() => Number, { nullable: true, defaultValue: 0 })
  @Prop({ required: false, type: Number, default: 0 })
  totalRidesAsDriver?: number;

  @Field({ nullable: true })
  @Prop({ required: false, type: String, default: null })
  esewaAccount?: string;

  @Field({ nullable: true })
  @Prop({ required: false, type: String, default: null })
  khaltiAccount?: string;

  @Field(() => GraphQLJSON, { nullable: true })
  @Prop({ required: false, type: Object, default: { RIDER: { earnings: true, appUpdates: true }, USER: { appUpdates: true, offersAndPromotion: true, ridesUpdate: true } } })
  notificationSettings?: Record<string, Record<string, boolean>>;

  @Field({ defaultValue: false })
  @Prop({ default: false })
  emailVerified: boolean;
}
export const UserDetailsSchema = SchemaFactory.createForClass(UserDetails);

// Create a 2dsphere index on the geoLocation field for $geoNear queries
UserDetailsSchema.index({ geoLocation: "2dsphere" });


export const userDetailModel = {
  name: UserDetails.name,
  schema: UserDetailsSchema,
};