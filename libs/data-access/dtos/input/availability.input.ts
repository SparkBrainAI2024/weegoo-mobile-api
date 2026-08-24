import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { DayOfWeek } from "../../entities/availability.entity";
import { GeoLocationInput } from "./geo-location.input";
import { ScheduledVehicleType } from "../../enums/vehicle.enum";

@InputType()
export class AvailabilityTimeSlotInput {
  @Field()
  @IsNotEmpty({ message: "AVAILABILITY.TIME_SLOT_START_REQUIRED" })
  @IsString({ message: "AVAILABILITY.TIME_SLOT_START_REQUIRED" })
  startTime: string;

  @Field()
  @IsNotEmpty({ message: "AVAILABILITY.TIME_SLOT_END_REQUIRED" })
  @IsString({ message: "AVAILABILITY.TIME_SLOT_END_REQUIRED" })
  endTime: string;
}

@InputType()
export class MajorStopInput {
  @Field()
  @IsString({ message: "AVAILABILITY.MAJOR_STOP_LABEL_REQUIRED" })
  @IsNotEmpty({ message: "AVAILABILITY.MAJOR_STOP_LABEL_REQUIRED" })
  label: string;

  @Field(() => GeoLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationInput)
  location?: GeoLocationInput;
}

@InputType()
export class AvailabilityDayInput {
  @Field(() => DayOfWeek)
  @IsEnum(DayOfWeek, { message: "AVAILABILITY.INVALID_DAY" })
  day: DayOfWeek;

  @Field(() => ScheduledVehicleType)
  @IsEnum(ScheduledVehicleType, { message: "AVAILABILITY.INVALID_VEHICLE_TYPE" })
  vehicleType: ScheduledVehicleType;

  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  isAvailableForBookings?: boolean;

  @Field(() => Boolean, { defaultValue: false })
  @IsOptional()
  @IsBoolean()
  isOneWay?: boolean;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  availableSeats?: number;

  @Field(() => Boolean, { defaultValue: true })
  @IsOptional()
  @IsBoolean()
  useSystemFare?: boolean;

  @Field(() => Number, { nullable: true })
  @ValidateIf((o: AvailabilityDayInput) => o.useSystemFare === false)
  @IsNumber({}, { message: "AVAILABILITY.AMOUNT_REQUIRED" })
  @Min(0.01, { message: "AVAILABILITY.AMOUNT_MUST_BE_POSITIVE" })
  amount?: number;

  @Field(() => [AvailabilityTimeSlotInput], { defaultValue: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityTimeSlotInput)
  timeSlots?: AvailabilityTimeSlotInput[];

  @Field(() => [MajorStopInput], { defaultValue: [] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MajorStopInput)
  majorStops?: MajorStopInput[];

  @Field(() => Number, { defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  pickupBufferTimeMinutes?: number;

  @Field(() => GeoLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationInput)
  pickupLocation?: GeoLocationInput;

  @Field(() => GeoLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationInput)
  dropOffLocation?: GeoLocationInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Input used to add a full week of availability. This can only be done on a
 * Sunday and may only contain days from Monday up to Saturday.
 */
@InputType()
export class AddAvailabilityInput {
  @Field(() => [AvailabilityDayInput])
  @IsArray({ message: "AVAILABILITY.DAYS_REQUIRED" })
  @ArrayNotEmpty({ message: "AVAILABILITY.DAYS_REQUIRED" })
  @ValidateNested({ each: true })
  @Type(() => AvailabilityDayInput)
  days: AvailabilityDayInput[];
}

/**
 * Input used to update (or remove the fields of) the availability of a driver
 * on a specific calendar date/day within its week.
 */
@InputType()
export class UpdateAvailabilityInput {
  @Field(() => Date)
  date: Date;

  @Field(() => [AvailabilityTimeSlotInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityTimeSlotInput)
  timeSlots?: AvailabilityTimeSlotInput[];

  @Field(() => [MajorStopInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MajorStopInput)
  majorStops?: MajorStopInput[];

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  pickupBufferTimeMinutes?: number;

  @Field(() => GeoLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationInput)
  pickupLocation?: GeoLocationInput;

  @Field(() => GeoLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoLocationInput)
  dropOffLocation?: GeoLocationInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
    notes?: string;

  @Field(() => ScheduledVehicleType, { nullable: true })
  @IsOptional()
  @IsEnum(ScheduledVehicleType, { message: "AVAILABILITY.INVALID_VEHICLE_TYPE" })
  vehicleType?: ScheduledVehicleType;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isAvailableForBookings?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isOneWay?: boolean;

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  availableSeats?: number;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  useSystemFare?: boolean;

  @Field(() => Number, { nullable: true })
  @ValidateIf((o: UpdateAvailabilityInput) => o.useSystemFare === false)
  @IsNumber({}, { message: "AVAILABILITY.AMOUNT_REQUIRED" })
  @Min(0.01, { message: "AVAILABILITY.AMOUNT_MUST_BE_POSITIVE" })
  amount?: number;
}