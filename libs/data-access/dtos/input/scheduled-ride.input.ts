import { Field, InputType, Int } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsOptional, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { RideLocationInput } from "./ride-location.input";
import { ScheduledVehicleType } from "../../enums/vehicle.enum";

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

  /**
   * Optional SCHEDULED vehicle type (JEEP / MICRO / CAR) the passenger wants.
   * When omitted, matchmaking offers every vehicle type that is ENABLED in the
   * admin pricings. When provided it must be a scheduled vehicle type AND be
   * enabled in the admin pricings, otherwise no drivers are matched.
   */
  @Field(() => ScheduledVehicleType, { nullable: true })
  @IsOptional()
  @IsEnum(ScheduledVehicleType, { message: "RIDES.INVALID_VEHICLE_TYPE" })
  vehicleType?: ScheduledVehicleType;
}