import { Field, Float, ObjectType } from "@nestjs/graphql";
import { CompleteRideFareBreakdown } from "./complete-ride-fare-breakdown.dto";

@ObjectType()
export class CompleteRideResult {
  @Field(() => String)
  rideId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => String)
  rideStatus: string;

  @Field(() => Float, { nullable: true })
  totalDurationInMinutes?: number;
  @Field(() => Float, { nullable: true })
  totalDurationInMinutes?: number;

  @Field(() => String, { nullable: true })
  totalDuration?: string;
  @Field(() => String, { nullable: true })
  totalDuration?: string;

  @Field(() => CompleteRideFareBreakdown)
  fareBreakdown: CompleteRideFareBreakdown;

  @Field(() => String, { nullable: true })
  completedAt?: string;

  @Field(() => Float, { nullable: true })
  walletAmount?: number;
}
