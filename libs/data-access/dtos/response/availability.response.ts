import { Field, ObjectType } from "@nestjs/graphql";
import { GeoLocation } from "../../common/geo.location";
import {
  AvailabilityTimeSlot,
  DayOfWeek,
  MajorStop,
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

  @Field(() => [AvailabilityTimeSlot])
  timeSlots: AvailabilityTimeSlot[];

  @Field(() => [MajorStop])
  majorStops: MajorStop[];

  @Field(() => Number)
  pickupBufferTimeMinutes: number;

  @Field(() => GeoLocation, { nullable: true })
  pickupLocation?: GeoLocation;

  @Field(() => GeoLocation, { nullable: true })
  dropOffLocation?: GeoLocation;

  @Field({ nullable: true })
  notes?: string;
}