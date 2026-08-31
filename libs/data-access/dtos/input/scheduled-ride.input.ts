import { Field, InputType, Int } from "@nestjs/graphql";
import { IsNotEmpty, Min, ValidateNested } from "class-validator";
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

  @Field(() => Date)
  @IsNotEmpty()
  bookingTime: Date;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @Min(1)
  noOfPassengers: number;
}