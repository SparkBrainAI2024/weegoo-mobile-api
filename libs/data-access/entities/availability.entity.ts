import { Field, ID, ObjectType, registerEnumType } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";
import { BaseEntity } from "../base/base.entity";
import { SavedLocation } from "../common/saved-location";
import { ScheduledVehicleType } from "../enums/vehicle.enum";

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
    "Days of the week a driver can set availability for (Sunday to Saturday)",
});

/**
 * Seat capacity for each scheduled vehicle type.
 * Used as the default available seat count when a driver has not set a custom value.
 */
export const VEHICLE_SEAT_CAPACITY: Record<ScheduledVehicleType, number> = {
  [ScheduledVehicleType.CAR]: 5,
  [ScheduledVehicleType.JEEP]: 8,
  [ScheduledVehicleType.MICRO]: 15,
};

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
}
export const AvailabilityTimeSlotSchema =
  SchemaFactory.createForClass(AvailabilityTimeSlot);

/**
 * One day of the week with its list of time slots.
 *
 * Each day carries its own route details so the driver can set
 * different major stops, notes, pickup and drop-off per day.
 * Each day also carries its concrete calendar `date` so the same
 * weekday cannot be duplicated for different dates.
 */
@ObjectType()
@Schema({ _id: false })
export class AvailabilityDay {
  @Field(() => DayOfWeek)
  @Prop({ required: true, type: String, enum: DayOfWeek })
  day: DayOfWeek;

  /** The concrete calendar date this availability belongs to
   *  (start of day). Prevents duplicate entries for the same date. */
  @Field(() => Date)
  @Prop({ required: true, type: Date })
  date: Date;

  /** Scheduled vehicle type (JEEP, MICRO, CAR) used on this day.
   *  The day's bookable seat capacity is derived from this type. */
  @Field(() => ScheduledVehicleType)
  @Prop({ required: true, type: String, enum: ["JEEP", "MICRO", "CAR"] })
  vehicleType: ScheduledVehicleType;

  /** Whether the driver accepts bookings on this day. */
  @Field(() => Boolean, { defaultValue: true })
  @Prop({ type: Boolean, default: true })
  isAvailableForBookings: boolean;

  /** True when the trip is one-way only (no return/service booking). */
  @Field(() => Boolean, { defaultValue: false })
  @Prop({ type: Boolean, default: false })
  isOneWay: boolean;

  /** Number of seats available for booking. Defaults to the capacity of the
   *  selected vehicle type (CAR = 5, JEEP = 8, MICRO = 15). */
  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  availableSeats: number;

  /** True when the fare is set by the platform (system fare).
   *  When false the driver supplies a custom amount for the day. */
  @Field(() => Boolean, { defaultValue: true })
  @Prop({ type: Boolean, default: true })
  useSystemFare: boolean;

  /** The fare amount applied for this day.
   *  Calculated from the matchmaking config when useSystemFare is true;
   *  taken from the driver's input when useSystemFare is false. */
  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  amount: number;

  @Field(() => [AvailabilityTimeSlot])
  @Prop({ type: [AvailabilityTimeSlotSchema], default: [] })
  timeSlots: AvailabilityTimeSlot[];

  /** Array of major stops (names) along the driver's route for this day. */
  @Field(() => [String])
  @Prop({ type: [String], default: [] })
  majorStops: string[];

  /** Buffer time (minutes) needed to travel to the pickup location. */
  @Field(() => Number, { defaultValue: 0 })
  @Prop({ type: Number, default: 0 })
  pickupBufferTimeMinutes: number;

    /** Pickup location — same shape as the driver's `workLocation`. */
  @Field(() => SavedLocation, { nullable: true })
  @Prop({ type: SavedLocation, default: null })
  pickupLocation?: SavedLocation;

  /** Drop-off location — same shape as the driver's `workLocation`. */
  @Field(() => SavedLocation, { nullable: true })
  @Prop({ type: SavedLocation, default: null })
  dropOffLocation?: SavedLocation;

  /** Additional notes from the driver for this day. */
  @Field({ nullable: true })
  @Prop({ type: String, default: null })
  notes?: string;
}
export const AvailabilityDaySchema =
  SchemaFactory.createForClass(AvailabilityDay);

/**
 * Rolling availability for a driver.
 *
/**
 * Business rules (enforced in AvailabilityService):
 *  - One availability document per driver (days are appended over time).
 *  - Days can be added/edited for TODAY up to 6 days ahead — there is no
 *    fixed weekly startDate/endDate window anymore.
 *  - Each AvailabilityDay carries its own concrete `date`; the same date
 *    cannot be added twice (duplicates are rejected).
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

  /** Per-day availability; each day carries its own concrete date and
   *  can contain multiple time slots plus its own major stops, notes,
   *  pickup and drop-off details. */
  @Field(() => [AvailabilityDay])
  @Prop({ type: [AvailabilityDaySchema], default: [] })
  days: AvailabilityDay[];
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);

// Fast lookup of a driver's availability document(s)
AvailabilitySchema.index({ driverId: 1 });