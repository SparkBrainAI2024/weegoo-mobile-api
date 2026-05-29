import { Field, InputType, Float, Int } from '@nestjs/graphql';
import { IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { VehicleType } from '@libs/data-access/enums/vehicle.enum';
import { ProvinceEnum } from '@libs/data-access/enums/user.enum';

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

  @Field()
  @IsString()
  city: string;

  @Field(() => ProvinceEnum)
  @IsEnum(ProvinceEnum)
  province: ProvinceEnum;

  @Field()
  @IsString()
  district: string;

  @Field()
  @IsString()
  fullAddress: string;
}

@InputType()
export class TriggerInstantMatchmakingInput {
  @Field(() => RideLocationInput)
  pickupLocation: RideLocationInput;

  @Field(() => RideLocationInput)
  dropoffLocation: RideLocationInput;

  @Field(() => VehicleType)
  @IsEnum(VehicleType)
  vehicleType: VehicleType;
  
  @Field(() => Int, { nullable: true })
  @Min(1)
  noOfPassengers?: number;
}