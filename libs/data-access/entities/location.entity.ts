import { Field, Float, ObjectType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { BaseEntity } from "../base/base.entity";
import { LocationStatus } from "../enums/location.enum";
import {
  SubLocation,
  SubLocationSchema,
} from "./location-sublocation.embedded";
import { paginateAndSoftDelete } from "../plugins/mongoose.plugin";

/**
 * A location (e.g. a city / area) that carries its own coordinates, an
 * active/inactive status and an array of embedded sub-locations (addresses
 * with their own coordinates).
 */
@ObjectType()
@Schema({ timestamps: true })
export class Location extends BaseEntity {
  /** Display name of the location. */
  @Field(() => String)
  @Prop({ required: true, type: String, trim: true })
  name: string;

  @Field(() => Float)
  @Prop({ required: true, type: Number, min: -90, max: 90 })
  latitude: number;

  @Field(() => Float)
  @Prop({ required: true, type: Number, min: -180, max: 180 })
  longitude: number;

  /** ACTIVE | INACTIVE — inactive locations must not be offered to users. */
  @Field(() => LocationStatus, { defaultValue: LocationStatus.ACTIVE })
  @Prop({
    required: true,
    type: String,
    enum: LocationStatus,
    default: LocationStatus.ACTIVE,
  })
  status: LocationStatus;

  /** Embedded sub-locations (addresses) that belong to this location. */
  @Field(() => [SubLocation], { defaultValue: [] })
  @Prop({ type: [SubLocationSchema], default: [] })
  subLocations: SubLocation[];
}

export type LocationDocument = HydratedDocument<Location>;

export const LocationSchema = SchemaFactory.createForClass(Location);

export const locationModel = {
  name: Location.name,
  schema: LocationSchema,
};

LocationSchema.plugin(paginateAndSoftDelete);

// Fast lookup of locations by status (and name within a status)
LocationSchema.index({ status: 1, name: 1 });
