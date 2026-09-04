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