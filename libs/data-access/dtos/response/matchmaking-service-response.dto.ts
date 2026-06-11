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
  total: number;
}

@ObjectType()
export class ScheduledFareBreakdownGraphQL {
  @Field(() => Float)
  baseFare: number;

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

  @Field(() => String)
  status: string; // 'no_drivers_found' | 'waiting_for_response' | 'accepted' | 'timeout'
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

  @Field(() => String, { nullable: true })
  driverImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field(() => FareBreakdownGraphQL, { nullable: true })
  estimatedFare?: FareBreakdownGraphQL;

  @Field(() => [MatchAttemptResultGraphQL])
  attempts: MatchAttemptResultGraphQL[];

  @Field(() => String)
  message: string;
}

@ObjectType()
export class ScheduledMatchResultGraphQL {
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

  @Field(() => String, { nullable: true })
  driverImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field(() => ScheduledFareBreakdownGraphQL, { nullable: true })
  estimatedFare?: ScheduledFareBreakdownGraphQL;

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

@ObjectType()
export class LocationUpdateResultGraphQL {
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
export class VehicleEstimateGraphQL {
  @Field(() => String)
  vehicleType: string;

  @Field(() => Float)
  estimatedFare: number;

  @Field(() => Float)
  distanceKm: number;

  @Field(() => Int)
  estimatedTimeInMinutes: number;

  @Field(() => String)
  comfortType: string;

  @Field(() => Boolean, { nullable: true })
  hasAC?: boolean;

  @Field(() => Int)
  noOfPassengers: number;
}