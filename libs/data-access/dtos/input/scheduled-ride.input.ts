import { Field, InputType, Int } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { RideLocationInput } from "./ride-location.input";
import { VehicleType } from "@libs/data-access/enums/vehicle.enum";

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

  @Field(() => VehicleType)
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @Field(() => Date)
  @IsNotEmpty()
  bookingTime: Date;

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @Min(1)
  noOfPassengers: number;
}