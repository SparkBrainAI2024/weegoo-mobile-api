import { ObjectType, Field, OmitType } from '@nestjs/graphql';
import { Rides } from '../../entities/rides.entity';

@ObjectType()
export class RideWithoutRelations extends OmitType(
  Rides,
  ['driver', 'passenger', 'vehicle'] as const,
) {}
@ObjectType()
export class UpdateRideResponse {
  @Field(() => RideWithoutRelations)
  ride: RideWithoutRelations;

  @Field(() => String)
  message: string;
}