// ongoing-ride.response.ts

import { Fare, PaymentDetails, RideLocation, Rides, RideStatus, RideTypes, VehicleType } from "@libs/data-access";
import { Field, Float, ID, Int, ObjectType } from "@nestjs/graphql";


@ObjectType()
export class VehicleSummary {
  @Field({ nullable: true })
  vehicleModel?: string;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field({ nullable: true })
  color?: string;

  @Field({ nullable: true })
  numberPlate?: string;

  @Field(() => VehicleType, { nullable: true })
  vehicleType?: VehicleType;
}

@ObjectType()
export class DriverSummary {
  @Field({ nullable: true })
  fullName?: string;

  @Field({ nullable: true })
  profileImage?: string;

  @Field(() => Float, { nullable: true })
  rating?: number;
}

@ObjectType()
export class OngoingRideResponse {
@Field(() => ID)
  _id: string;

  @Field(()=> String)
  rideUUId: string;

  @Field(() => RideStatus)
  rideStatus: RideStatus;

  @Field(() => RideTypes)
  rideType: RideTypes;

  @Field(() => Date, { nullable: true })
  rideStartedAt?: Date;

  @Field(() => Date, { nullable: true })
  rideCompletedAt?: Date;

  @Field(() => Number, { nullable: true })
  estimatedTimeInMinutes?: number;

  @Field(() => Number, { nullable: true })
  estimatedFare?: number;

  @Field(() => Number, { nullable: true })
  distanceInKm?: number;

  @Field(() => RideLocation, { nullable: true })
  pickupLocation?: RideLocation;

  @Field(() => RideLocation, { nullable: true })
  dropoffLocation?: RideLocation;

  @Field(() => Fare, { nullable: true })
  fare?: Fare;

  @Field(() => PaymentDetails, { nullable: true })
  paymentDetails?: PaymentDetails;

    @Field(() => VehicleSummary, { nullable: true })
    vehicle?: VehicleSummary;

    @Field(() => DriverSummary, { nullable: true })
    driver?: DriverSummary;

    @Field({ nullable: true })
    ablyChannelId: string;

    @Field({ nullable: true })
    driverChannelId?: string;

    @Field({ nullable: true })
    passengerChannelId?: string;

    @Field({ nullable: true })
    driverLocationChannelId?: string;

    @Field({ nullable: true })
    passengerLocationChannelId?: string;

    @Field(() => Number, { nullable: true })
    distanceToReachPassenger?: number;

    @Field(() => Number, { nullable: true })
    estimatedTimeToReachPassenger?: number;

}
