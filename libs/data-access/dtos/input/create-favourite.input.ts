import { RideTypes } from '@libs/data-access/enums/rides.enum';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { RideLocationInput } from './ride-location.input';
import { VehicleType } from '@libs/data-access/enums/vehicle.enum';

@InputType()
export class CreateFavouriteInput {
  @Field(() => RideTypes)
  @IsNotEmpty()
  @IsEnum(RideTypes)
  rideType: RideTypes;

  @Field(() =>RideLocationInput)
  @IsOptional()
  pickupLocation: RideLocationInput;

  @Field(() => RideLocationInput)
  @IsOptional()
  dropoffLocation: RideLocationInput;

  @Field(() => VehicleType)
  @IsNotEmpty()
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @Field(() => Int, { defaultValue: 1 })
  @IsOptional()
  @Min(1)
  noOfPassengers?: number;
}