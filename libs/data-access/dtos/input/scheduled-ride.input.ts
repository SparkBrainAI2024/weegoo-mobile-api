import { Field, InputType, Float, Int } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsOptional, Min, ValidateNested } from "class-validator";
import { RideTypes } from "@libs/data-access/enums/rides.enum";
import { Type } from "class-transformer";
import { RideLocationInput } from "./ride-location.input";

@InputType()
export class TriggerScheduledMatchmakingInput {
  @Field(() => RideLocationInput)
  @ValidateNested()
  @Type(() => RideLocationInput)
  pickupLocation: RideLocationInput;

  @Field(() => RideLocationInput)
  @ValidateNested()
  @Type(() => RideLocationInput)
  dropoffLocation: RideLocationInput;

  @Field(() => RideTypes)
  @IsEnum(RideTypes)
  rideType: RideTypes;

  @Field(() => Date)
  @IsNotEmpty()
  bookingTime: Date;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @Min(1)
  noOfPassengers: number;
}