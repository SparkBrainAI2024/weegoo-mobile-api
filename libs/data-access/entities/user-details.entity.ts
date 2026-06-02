import { Field, ID, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { GeoLocation } from "../common/geo.location";
import { GenderEnum, ridePreference, ProvinceEnum, DriverOnlineStatus } from "../enums/user.enum";
import { BaseEntity } from "../base/base.entity";
import { Vehicle } from "./vehicle.entity";
import { VehicleImage } from "./vehicle-image.embedded";
import { PublicImage } from "../common/public-image.entity";

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



  @Field(()=> [PublicImage])
  @Prop({ type: [PublicImage], default: [] })
  profileImages: PublicImage[];

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

  @Field({ nullable: true ,defaultValue: 0})
  @Prop({ required: false, type: Number, defaultValue: 0 })
  rating?: number;
}
export const UserDetailsSchema = SchemaFactory.createForClass(UserDetails);

export const userDetailModel = {
  name: UserDetails.name,
  schema: UserDetailsSchema,
};