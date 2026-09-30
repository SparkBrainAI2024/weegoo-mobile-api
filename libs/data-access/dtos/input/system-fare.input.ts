import { Field, Float, InputType } from "@nestjs/graphql";
import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

/**
 * One end of a system-fare estimation. The address is only informational —
 * the fare is calculated from the coordinates, which are required.
 */
@InputType()
export class SystemFareLocationInput {
  @Field(() => String, {
    nullable: true,
    description: "Address of the location (informational only).",
  })
  @IsOptional()
  @IsString()
  address?: string;

  @Field(() => Float, { description: "Latitude of the location (required)." })
  @IsNumber({}, { message: "AVAILABILITY.FARE_LOCATION_REQUIRED" })
  @Min(-90)
  @Max(90)
  latitude: number;

  @Field(() => Float, {
    description: "Longitude of the location (required).",
  })
  @IsNumber({}, { message: "AVAILABILITY.FARE_LOCATION_REQUIRED" })
  @Min(-180)
  @Max(180)
  longitude: number;
}

/**
 * System fare estimation request. Both the pickup and the drop-off location
 * are required — the fare cannot be derived without them.
 *
 * The vehicle type is never sent by the client: it is taken from the
 * authenticated driver's vehicle.
 */
@InputType()
export class SystemFareInput {
  @Field(() => SystemFareLocationInput, {
    description: "Pickup location (required).",
  })
  @IsNotEmpty({ message: "AVAILABILITY.FARE_LOCATION_REQUIRED" })
  @ValidateNested()
  @Type(() => SystemFareLocationInput)
  pickupLocation: SystemFareLocationInput;

  @Field(() => SystemFareLocationInput, {
    description: "Drop-off location (required).",
  })
  @IsNotEmpty({ message: "AVAILABILITY.FARE_LOCATION_REQUIRED" })
  @ValidateNested()
  @Type(() => SystemFareLocationInput)
  dropOffLocation: SystemFareLocationInput;
}
