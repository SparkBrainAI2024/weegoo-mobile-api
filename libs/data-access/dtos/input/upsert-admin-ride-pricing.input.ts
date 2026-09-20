import { Field, InputType } from "@nestjs/graphql";
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, Min } from "class-validator";
import { Type } from "class-transformer";
import { ValidateNested, ArrayMinSize } from "class-validator";
import { AnyVehicleType, VehicleType } from "../../enums/vehicle.enum";

@InputType()
export class UpsertAdminRidePricingInput {
  @Field(() => AnyVehicleType)
  @IsEnum(AnyVehicleType)
  @IsNotEmpty()
  vehicleType: AnyVehicleType;

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

  @Field(() => Boolean)
  @IsBoolean()
  isEnabled: boolean;
}

@InputType()
export class BulkUpsertAdminRidePricingInput {
  @Field(() => [UpsertAdminRidePricingInput])
  @ValidateNested({ each: true })
  @Type(() => UpsertAdminRidePricingInput)
  @ArrayMinSize(1)
  pricingList: UpsertAdminRidePricingInput[];
}
