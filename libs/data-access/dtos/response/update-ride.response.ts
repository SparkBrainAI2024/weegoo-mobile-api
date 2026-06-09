import { ObjectType, Field, ID } from '@nestjs/graphql';
import { Rides } from '../../entities/rides.entity';

@ObjectType()
export class UpdateRideResponse {
  @Field(() => Rides)
  ride: Rides;

  @Field(() => String)
  message: string;
}