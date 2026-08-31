import { Field, ObjectType, Int } from "@nestjs/graphql";
import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { ApiProperty } from "@nestjs/swagger";

/**
 * Time slots associated with the scheduled booking (mirrors the driver's
 * availability time window the booking falls / will fall into).
 */
@ObjectType()
export class RideScheduleTimeSlot {
  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false, default: null })
  @ApiProperty({ required: false })
  startTime?: string;
}
export const RideScheduleTimeSlotSchema =
  SchemaFactory.createForClass(RideScheduleTimeSlot);

/**
 * Schedule information for a SCHEDULED ride booking.
 *
 * Unlike INSTANT rides (matched in real-time), a scheduled ride is a booking:
 * a driver may accept any time up to the pickup buffer. This sub-document
 * stores the booking details — booking type, requested vehicle type, passenger
 * count, the concrete date/booking time and the driver availability window the
 * booking was matched to.
 */
@ObjectType()
@Schema({ _id: false })
export class RideSchedule {
  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false, default: null })
  @ApiProperty({ required: false })
  bookingType?: string;

  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, required: false, default: null })
  @ApiProperty({ required: false })
  bookingTime?: Date;

  @Field(() => Int, { nullable: true })
  @Prop({ type: Number, required: false, default: 0 })
  @ApiProperty({ required: false })
  noOfPassengers?: number;

  /**
   * Requested scheduled vehicle type (JEEP, MICRO, CAR). Independent of the
   * concrete driver/vehicle that later accepts the ride.
   */
  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false, default: null })
  @ApiProperty({ required: false })
  vehicleType?: string;

  /** Concrete calendar date (UTC midnight) of the requested booking day. */
  @Field(() => Date, { nullable: true })
  @Prop({ type: Date, required: false, default: null })
  @ApiProperty({ required: false })
  bookingDate?: Date;

  /** Day-of-week name of the requested booking day (e.g. "MONDAY"). */
  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false, default: null })
  @ApiProperty({ required: false })
  day?: string;

  /** Whether it's a whole-day / open booking or fixed to specific time slots. */
  @Field(() => Boolean, { nullable: true, defaultValue: false })
  @Prop({ type: Boolean, required: false, default: false })
  @ApiProperty({ required: false })
  isFlexible?: boolean;

  /** Buffer (minutes) the driver needs to reach the pickup. */
  @Field(() => Int, { nullable: true })
  @Prop({ type: Number, required: false, default: 0 })
  @ApiProperty({ required: false })
  pickupBufferTimeMinutes?: number;

  /** Time slots on the matched driver's availability day (HH:mm). */
  @Field(() => [RideScheduleTimeSlot], { nullable: true })
  @Prop({ type: [RideScheduleTimeSlotSchema], required: false, default: [] })
  @ApiProperty({ required: false })
  timeSlots?: RideScheduleTimeSlot[];

  /** Reference to the matched availability day of the driver. */
  @Field(() => String, { nullable: true })
  @Prop({ type: String, required: false, default: null })
  @ApiProperty({ required: false })
  availabilityDayId?: string;
}
export const RideScheduleSchema = SchemaFactory.createForClass(RideSchedule);