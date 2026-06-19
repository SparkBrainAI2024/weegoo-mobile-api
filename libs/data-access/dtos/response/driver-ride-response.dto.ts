import { Field, ObjectType, Float } from "@nestjs/graphql";
@ObjectType()
export class LocationInfo {
  @Field({ nullable: true })
  address?: string;

  @Field(() => [Float], { nullable: true })
  coordinates?: number[];

  @Field({ nullable: true })
  city?: string;
}

@ObjectType()
export class DriverInfo {
  @Field()
  driverId: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;
}

@ObjectType()
export class PassengerInfo {
  @Field()
  passengerId: string;

  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field({ nullable: true })
  gender?: string;
}

@ObjectType()
export class VehicleInfo {
  @Field({ nullable: true })
  vehicleId?: string;

  @Field({ nullable: true })
  vehicleModel?: string;

  @Field({ nullable: true })
  vehicleType?: string;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  numberPlate?: string;

  @Field(() => Float, { nullable: true })
  year?: number;
}


@ObjectType()
export class DriverRideDetails {
  @Field()
  rideId: string;

  @Field()
  rideUUId: string;

  @Field({ nullable: true })
  rideType?: string;

  @Field({ nullable: true })
  rideStatus?: string;

  @Field(() => LocationInfo, { nullable: true })
  pickupLocation?: LocationInfo;

  @Field(() => LocationInfo, { nullable: true })
  dropoffLocation?: LocationInfo;

  @Field(() => Float, { nullable: true })
  distanceInKm?: number;

  @Field(() => Float, { nullable: true })
  estimatedFare?: number;

  @Field(() => Float, { nullable: true })
  estimatedTimeInMinutes?: number;

  @Field(() => DriverInfo, { nullable: true })
  driver?: DriverInfo;

  @Field(() => PassengerInfo, { nullable: true })
  passenger?: PassengerInfo;

  @Field(() => VehicleInfo, { nullable: true })
  vehicle?: VehicleInfo;

  @Field({ nullable: true })
  acceptedAt?: string;
}

@ObjectType()
export class DriverRideResponse {
  @Field()
  success: boolean;

  @Field()
  message: string;

  @Field(() => DriverRideDetails, { nullable: true })
  data?: DriverRideDetails;
}

