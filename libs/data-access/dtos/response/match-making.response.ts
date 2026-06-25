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

  @Field(() => String, { nullable: true })
  status?: string;
}

@ObjectType()
export class PickupDropoffLocationInfo {
  @Field(() => String, { nullable: true })
  address?: string;

  @Field(() => [Float], { nullable: true })
  coordinates?: number[];

  @Field(() => String, { nullable: true })
  city?: string;
}

@ObjectType()
export class MatchedDriverInfo {
  @Field(() => String)
  driverId: string;

  @Field(() => String, { nullable: true })
  fullName?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  profileImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;
}

@ObjectType()
export class MatchedVehicleInfo {
  @Field(() => String, { nullable: true })
  vehicleId?: string;

  @Field(() => String, { nullable: true })
  vehicleModel?: string;

  @Field(() => String, { nullable: true })
  vehicleType?: string;

  @Field(() => String, { nullable: true })
  color?: string;

  @Field(() => String, { nullable: true })
  numberPlate?: string;

  @Field(() => Float, { nullable: true })
  year?: number;
}

@ObjectType()
export class MatchedPassengerInfo {
  @Field(() => String, { nullable: true })
  passengerId?: string;

  @Field(() => String, { nullable: true })
  fullName?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  profileImage?: string;

  @Field(() => String, { nullable: true })
  gender?: string;
}

@ObjectType()
export class AcceptedDetailsResponse {
  @Field(() => String)
  rideId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => MatchedDriverInfo, { nullable: true })
  driver?: MatchedDriverInfo;

  @Field(() => MatchedVehicleInfo, { nullable: true })
  vehicle?: MatchedVehicleInfo;

  @Field(() => MatchedPassengerInfo, { nullable: true })
  passenger?: MatchedPassengerInfo;

  @Field(() => PickupDropoffLocationInfo, { nullable: true })
  pickupLocation?: PickupDropoffLocationInfo;

  @Field(() => PickupDropoffLocationInfo, { nullable: true })
  dropoffLocation?: PickupDropoffLocationInfo;

  @Field(() => Float, { nullable: true })
  estimatedFare?: number;

  @Field(() => Float, { nullable: true })
  estimatedTimeInMinutes?: number;

  @Field(() => Float, { nullable: true })
  distanceInKm?: number;

  @Field(() => String, { nullable: true })
  acceptedAt?: string;

  @Field(() => String, { nullable: true })
  ablyChannelId?: string;

  @Field(() => String, { nullable: true })
  driverLocationChannel?: string;
}

@ObjectType()
export class EstimatedFareBreakdownResponse {
  @Field(() => Float, { nullable: true })
  pickupCost?: number;

  @Field(() => Float, { nullable: true })
  distanceCost?: number;

  @Field(() => Float, { nullable: true })
  durationCost?: number;

  @Field(() => Float, { nullable: true })
  total?: number;
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

  @Field(() => String, { nullable: true })
  driverImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;

  @Field(() => String, { nullable: true })
  rideType?: string;

  @Field(() => String, { nullable: true })
  rideStatus?: string;

  @Field(() => [MatchAttemptInfo], { nullable: true })
  attempts?: MatchAttemptInfo[];

  @Field(() => EstimatedFareBreakdownResponse, { nullable: true })
  estimatedFare?: EstimatedFareBreakdownResponse;

  @Field(() => Float, { nullable: true })
  estimatedFareTotal?: number;

  @Field(() => Float, { nullable: true })
  estimatedTimeInMinutes?: number;

  @Field(() => Float, { nullable: true })
  distanceInKm?: number;

  @Field(() => Int, { nullable: true })
  noOfPassengers?: number;

  @Field(() => String, { nullable: true })
  ablyChannelId?: string;

  @Field(() => String, { nullable: true })
  driverLocationChannel?: string;

  @Field(() => PickupDropoffLocationInfo, { nullable: true })
  pickupLocation?: PickupDropoffLocationInfo;

  @Field(() => PickupDropoffLocationInfo, { nullable: true })
  dropoffLocation?: PickupDropoffLocationInfo;

  @Field(() => AcceptedDetailsResponse, { nullable: true })
  acceptedDetails?: AcceptedDetailsResponse;
}