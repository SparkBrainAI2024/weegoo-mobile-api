import { Field, ObjectType, Int, Float } from '@nestjs/graphql';

@ObjectType()
export class LocationUpdateResult {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => Float)
  latitude: number;

  @Field(() => Float)
  longitude: number;

  @Field(() => String)
  updatedAt: string;
}

@ObjectType()
export class MatchAttemptInfo {
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
export class TriggerMatchmakingResultResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => Boolean)
  matched: boolean;

  @Field(() => String)
  rideId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => String, { nullable: true })
  driverId?: string;

  @Field(() => String, { nullable: true })
  driverName?: string;

  @Field(() => [MatchAttemptInfo], { nullable: true })
  attempts?: MatchAttemptInfo[];
}