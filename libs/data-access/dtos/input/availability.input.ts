import { Field, InputType } from "@nestjs/graphql";
import {
  ArrayMaxSize,
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
  IsDate
} from "class-validator";
import { Type } from "class-transformer";
import { DayOfWeek } from "../../entities/availability.entity";
import { SavedLocationInput } from "./saved-location.input";
import { ScheduledVehicleType } from "../../enums/vehicle.enum";

@InputType()
export class AvailabilityTimeSlotInput {
  @Field()
  @IsNotEmpty({ message: "AVAILABILITY.TIME_SLOT_START_REQUIRED" })
  @IsString({ message: "AVAILABILITY.TIME_SLOT_START_REQUIRED" })
  startTime: string;
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

  @Field(() => [String], { defaultValue: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: "AVAILABILITY.MAJOR_STOP_LABEL_REQUIRED" })
  majorStops?: string[];

  @Field(() => Number, { defaultValue: 0 })
  @IsOptional()
  @IsNumber()
  pickupBufferTimeMinutes?: number;

    @Field(() => SavedLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedLocationInput)
  pickupLocation?: SavedLocationInput;

  @Field(() => SavedLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedLocationInput)
  dropOffLocation?: SavedLocationInput;

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
  @ArrayMaxSize(1, { message: "AVAILABILITY.ONE_DAY_AT_A_TIME" })
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
  @IsDate({ message: "AVAILABILITY.INVALID_DAY" })
  date: Date;

  @Field(() => [AvailabilityTimeSlotInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityTimeSlotInput)
  timeSlots?: AvailabilityTimeSlotInput[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true, message: "AVAILABILITY.MAJOR_STOP_LABEL_REQUIRED" })
  majorStops?: string[];

  @Field(() => Number, { nullable: true })
  @IsOptional()
  @IsNumber()
  pickupBufferTimeMinutes?: number;

    @Field(() => SavedLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedLocationInput)
  pickupLocation?: SavedLocationInput;

  @Field(() => SavedLocationInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedLocationInput)
  dropOffLocation?: SavedLocationInput;

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