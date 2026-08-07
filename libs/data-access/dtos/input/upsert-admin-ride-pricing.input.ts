import { Field, InputType } from "@nestjs/graphql";
import { IsEnum, IsNotEmpty, IsNumber, Min } from "class-validator";
import { VehicleType } from "../../enums/vehicle.enum";

@InputType()
export class UpsertAdminRidePricingInput {
  @Field(() => VehicleType)
  @IsEnum(VehicleType)
  @IsNotEmpty()
  vehicleType: VehicleType;

  @Field(() => Number)
  @IsNumber()
  @Min(0)
  commission: number;

  @Field(() => Number)
  @IsNumber()
  @Min(0)
  baseFare: number;

  @Field(() => Number)
  @IsNumber()
  @Min(0)
  amountPerKm: number;

  @Field(() => Number)
  @IsNumber()
  @Min(0)
  amountPerMinute: number;
}