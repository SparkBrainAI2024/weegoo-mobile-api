import { Field, InputType, Float, Int } from "@nestjs/graphql";
import { IsEnum, Min, ValidateNested } from "class-validator";
import { VehicleType } from "@libs/data-access/enums/vehicle.enum";
import { Type } from "class-transformer";
import { RideLocationInput } from "./ride-location.input";

@InputType()
export class TriggerInstantMatchmakingInput {
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

  @Field(() => Int, { nullable: true, defaultValue: 1 })
  @Min(1)
  noOfPassengers: number;
}