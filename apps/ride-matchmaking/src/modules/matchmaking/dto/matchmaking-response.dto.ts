import { Field, ObjectType, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class FareBreakdownGraphQL {
  @Field(() => Float)
  pickupCost: number;

  @Field(() => Float)
  distanceCost: number;

  @Field(() => Float)
  durationCost: number;

  @Field(() => Float)
  subtotal: number;

  @Field(() => Float)
  weatherSurcharge: number;

  @Field(() => Float)
  weatherSurchargePercent: number;

  @Field(() => Float)
  trafficSurcharge: number;

  @Field(() => Float)
  trafficSurchargePercent: number;

  @Field(() => Float)
  total: number;
}

@ObjectType()
export class MatchAttemptResultGraphQL {
  @Field(() => Int)
  attemptNumber: number;

  @Field(() => Float)
  radiusKm: number;

  @Field(() => Int)
  waitTimeSeconds: number;

  @Field(() => Int)
  driversFound: number;

  @Field(() => Int)
  driversRequested: number;

  @Field(() => Boolean)
  driverAccepted: boolean;

  @Field(() => String, { nullable: true })
  acceptedDriverId?: string;

  @Field(() => Boolean)
  timeoutExpired: boolean;
}

@ObjectType()
export class MatchResultGraphQL {
  @Field(() => Boolean)
  matched: boolean;

  @Field(() => String)
  rideId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => String)
  passengerId: string;

  @Field(() => String, { nullable: true })
  driverId?: string;

  @Field(() => String, { nullable: true })
  driverName?: string;

  @Field(() => FareBreakdownGraphQL, { nullable: true })
  estimatedFare?: FareBreakdownGraphQL;

  @Field(() => [MatchAttemptResultGraphQL])
  attempts: MatchAttemptResultGraphQL[];

  @Field(() => String)
  message: string;
}

@ObjectType()
export class DriverResponseResultGraphQL {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;
}