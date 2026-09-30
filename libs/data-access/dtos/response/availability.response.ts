import { Field, ObjectType } from "@nestjs/graphql";
import { SavedLocation } from "../../common/saved-location";
import { ScheduledVehicleType } from "../../enums/vehicle.enum";
import {
  AvailabilityTimeSlot,
  DayOfWeek,
} from "../../entities/availability.entity";

/**
 * Detail of a single availability day resolved from a specific calendar date.
 */
@ObjectType()
export class AvailabilityDayDetail {
  @Field(() => Date)
  date: Date;

  @Field(() => DayOfWeek, {})
  day: DayOfWeek;

  @Field(() => ScheduledVehicleType)
  vehicleType: ScheduledVehicleType;

  @Field(() => Boolean)
  isAvailableForBookings: boolean;

  @Field(() => Boolean)
  isOneWay: boolean;

  @Field(() => Number)
  availableSeats: number;

  /** Independent return-trip seat count for this day (round trips only).
   *  Tracked separately from `availableSeats` (outbound). */
  @Field(() => Number)
  returnAvailableSeats: number;

  @Field(() => Boolean)
  useSystemFare: boolean;

  @Field(() => Number)
  amount: number;

  @Field(() => [AvailabilityTimeSlot])
  timeSlots: AvailabilityTimeSlot[];

  @Field(() => [String])
  majorStops: string[];

  @Field(() => Number)
  pickupBufferTimeMinutes: number;

    @Field(() => SavedLocation, { nullable: true })
  pickupLocation?: SavedLocation;

  @Field(() => SavedLocation, { nullable: true })
  dropOffLocation?: SavedLocation;

  @Field({ nullable: true })
  notes?: string;
}

/**
 * The configured maximum seat capacity for one scheduled vehicle type.
 * Values come from the VEHICLE_SEAT_CAPACITY config on the availability entity.
 */
@ObjectType()
export class ScheduledVehicleSeatCapacity {
  @Field(() => ScheduledVehicleType)
  vehicleType: ScheduledVehicleType;

  @Field(() => Number)
  maxSeats: number;
}

/**
 * System fare for one pickup/drop-off pair.
 *
 * Only the final amount is exposed: the rate/distance/duration breakdown it was
 * derived from stays internal (see the availability service), and the vehicle
 * type used is the authenticated driver's own — never a client-supplied value.
 */
@ObjectType()
export class SystemFareEstimate {
  @Field(() => Number, {
    description:
      "System fare amount, calculated for the driver's own vehicle type from the given pickup and drop-off.",
  })
  amount: number;
}