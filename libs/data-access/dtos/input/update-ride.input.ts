import { InputType, Field, ID } from '@nestjs/graphql';
import { IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { RideLocationInput } from './ride-location.input';

@InputType()
export class UpdateRideInput {
  @Field(() => ID)
  @IsMongoId()
  @IsNotEmpty()
  rideId: string;

  @Field(() => Date, { nullable: true })
  @IsOptional()
  bookingTime?: Date;

  @Field(() => RideLocationInput, { nullable: true })
  @IsOptional()
  pickupLocation?: RideLocationInput;

  @Field(() => RideLocationInput, { nullable: true })
  @IsOptional()
  dropoffLocation?: RideLocationInput;
}