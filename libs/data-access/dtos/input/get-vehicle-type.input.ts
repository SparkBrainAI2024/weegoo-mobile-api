import { Field, InputType } from "@nestjs/graphql";
import { IsEnum } from "class-validator";
import { ridePreference } from "../../enums/user.enum";

@InputType()
export class GetVehicleTypeInput {
  @Field(() => ridePreference, {
    description:
      "The ride preference used to determine which vehicle types to return. INSTANT returns car, motorbike, scooter. SCHEDULED returns jeep, car, micro. BOTH returns both sets.",
  })
  @IsEnum(ridePreference)
  ridePreference: ridePreference;
}