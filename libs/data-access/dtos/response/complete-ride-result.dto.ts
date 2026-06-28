import { Field, Int, ObjectType } from '@nestjs/graphql';
import { CompleteRideFareBreakdown } from './complete-ride-fare-breakdown.dto';

@ObjectType()
export class CompleteRideResult {
  @Field(() => String)
  rideId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => String)
  rideStatus: string;

  @Field(() => Int)
  totalDurationInMinutes: number;

  @Field(() => String)
  totalDuration: string;

  @Field(() => CompleteRideFareBreakdown)
  fareBreakdown: CompleteRideFareBreakdown;

  @Field(() => String)
  completedAt: string;
}
