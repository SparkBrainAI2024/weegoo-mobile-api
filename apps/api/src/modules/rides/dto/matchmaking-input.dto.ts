import { Field, InputType, Float, Int } from "@nestjs/graphql";
import { IsString, IsEnum, IsNumber, Min, IsOptional, ValidateNested } from "class-validator";
import { VehicleType } from "@libs/data-access/enums/vehicle.enum";
import { ProvinceEnum } from "@libs/data-access/enums/user.enum";
import { Type } from "class-transformer";

@InputType()
export class RideLocationInput {
  @Field(() => Float)
  @IsNumber()
  latitude: number;

  @Field(() => Float)
  @IsNumber()
  longitude: number;

  @Field()
  @IsString()
  address: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  city?: string;

  @Field(() => ProvinceEnum, { nullable: true })
  @IsEnum(ProvinceEnum)
  @IsOptional()
  province?: ProvinceEnum;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  district?: string;

  @Field()
  @IsString()
  fullAddress: string;
}

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
