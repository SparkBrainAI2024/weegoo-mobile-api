import { RideTypes } from '@libs/data-access/enums/rides.enum';
import { Field, InputType, Int } from '@nestjs/graphql';
import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, Min } from 'class-validator';
import { RideLocationInput } from './ride-location.input';
import { VehicleType } from '@libs/data-access/enums/vehicle.enum';

@InputType()
export class CreateFavouriteInput {
  @Field(() => String)
  @IsMongoId({
    message: 'RIDE.INVALID_RIDE_ID',
  })
  rideId: string;
}