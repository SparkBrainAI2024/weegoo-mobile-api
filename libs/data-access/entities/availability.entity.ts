import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "../base/base.entity";
import { GeoLocation } from "../common/geo.location";

export type AvailabilityDocument = Availability & HydratedDocument<Availability>;

/**
 * Days of the week a driver can set availability for.
 * The availability week runs MONDAY → SATURDAY (no SUNDAY).
 */
export enum DayOfWeek {
  SUNDAY = "SUNDAY",
  MONDAY = "MONDAY",
  TUESDAY = "TUESDAY",
  WEDNESDAY = "WEDNESDAY",
  THURSDAY = "THURSDAY",
  FRIDAY = "FRIDAY",
  SATURDAY = "SATURDAY",
}

registerEnumType(DayOfWeek, {
  name: "DayOfWeek",
  description:
    "Days of the week a driver can set availability for (Monday to Saturday)",
});

/**
 * A single time slot within one day of a driver's weekly availability.
 * Times are 24h "HH:mm" strings (e.g. "09:00", "17:30").
 * A day can hold multiple non-overlapping time slots.
 */
@ObjectType()
@Schema({ _id: false })
export class AvailabilityTimeSlot {
  @Field(() => String)
  @Prop({ required: true, type: String })
  startTime: string;

  @Field(() => String)
  @Prop({ required: true, type: String })
  endTime: string;
}
export const AvailabilityTimeSlotSchema =
  SchemaFactory.createForClass(AvailabilityTimeSlot);

/**
 * A major stop along the driver's route for the week.
 */
@ObjectType()
@Schema({ _id: false })
export class MajorStop {
  @Field(() => String)
  @Prop({ required: true, type: String })
  label: string;

  /** GeoJSON point [longitude, latitude] — optional. */
  @Field(() => GeoLocation, { nullable: true })
  @Prop({ type: Object, default: null })
  location?: GeoLocation;
}
export const MajorStopSchema = SchemaFactory.createForClass(MajorStop);

/**
 * One day of the week with its list of time slots.
 *
 * Each day carries its own route details so the driver can set
 * different major stops, notes, pickup and drop-off per day.
 */
@ObjectType()
@Schema({ _id: false })
export class AvailabilityDay {
  @Field(() => DayOfWeek)
  @Prop({ required: true, type: String, enum: DayOfWeek })
  day: DayOfWeek;

  @Field(() => [AvailabilityTimeSlot])
  @Prop({ type: [AvailabilityTimeSlotSchema], default: [] })
  timeSlots: AvailabilityTimeSlot[];

  /** Array of major stops along the driver's route for this day. */
  @Field(() => [MajorStop])
  @Prop({ type: [MajorStopSchema], default: [] })
  majorStops: MajorStop[];

  /** Buffer time (minutes) needed to travel to the pickup location. */
  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  pickupBufferTimeMinutes: number;

  /** Pickup location as a GeoJSON point [longitude, latitude]. */
  @Field(() => GeoLocation, { nullable: true })
  @Prop({ type: Object, default: null })
  pickupLocation?: GeoLocation;

  /** Drop-off location as a GeoJSON point [longitude, latitude]. */
  @Field(() => GeoLocation, { nullable: true })
  @Prop({ type: Object, default: null })
  dropOffLocation?: GeoLocation;

  /** Additional notes from the driver for this day. */
  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  notes?: string;
}
export const AvailabilityDaySchema =
  SchemaFactory.createForClass(AvailabilityDay);

/**
 * Weekly availability for a driver.
 *
 * Business rules (enforced in AvailabilityService):
 *  - One availability document per driver per week (startDate → endDate).
 *  - The week always runs Monday (startDate) → Saturday (endDate).
 *  - A driver cannot set NEXT week's availability until the current
 *    week has fully passed (i.e. now > latest existing endDate).
 *
 * Each day holds an array of time slots so a single day can have
 * multiple availability windows.
 */
@ObjectType()
@Schema({ timestamps: true })
export class Availability extends BaseEntity {
  @Field(() => ID)
  _id: Types.ObjectId;

  @Field(() => ID)
  @Prop({ type: Types.ObjectId, index: true, ref: "User", required: true })
  driverId: Types.ObjectId;

  /** Week start date — always a Monday at 00:00. */
  @Field(() => Date)
  @Prop({ required: true, type: Date })
  startDate: Date;

  /** Week end date — always the Saturday of the same week, end of day. */
  @Field(() => Date)
  @Prop({ required: true, type: Date })
  endDate: Date;

  /** Per-day availability; each day can contain multiple time slots and its
   *  own major stops, notes, pickup and drop-off details. */
  @Field(() => [AvailabilityDay])
  @Prop({ type: [AvailabilityDaySchema], default: [] })
  days: AvailabilityDay[];
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);

// One availability document per driver per week start date
AvailabilitySchema.index(
  { driverId: 1, startDate: 1 },
  { unique: true },
);