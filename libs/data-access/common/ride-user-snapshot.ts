import { Field, InputType, ObjectType } from "@nestjs/graphql";
import { Prop } from "@nestjs/mongoose";
import { GeoLocation } from "./geo.location";

@ObjectType()
export class RideUserSnapshot {
  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  fullName?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  profileImage?: string;

  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  rating?: number;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  phone?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  locationChannelId?: string;

  @Field(() => GeoLocation, { nullable: true })
  @Prop({ type: Object, default: {} })
  geoLocation?: GeoLocation;

  // common/ride-user-snapshot.ts — add these two fields
  @Field(() => Number, { nullable: true })
  @Prop({ type: Number, default: 0 })
  totalTripsAsPassenger?: number;

  @Field(() => Number, { nullable: true })
  @Prop({ type: Number, default: 0 })
  totalRidesAsDriver?: number;
}

@InputType()
export class RideUserInputSnapshot {
  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  fullName?: string;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  profileImage?: string;

  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  rating?: number;

  @Field(() => String, { nullable: true })
  @Prop({ type: String })
  phone?: string;
}
