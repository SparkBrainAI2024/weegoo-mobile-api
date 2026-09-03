// dtos/response/rides-list.response.ts
import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { Rides } from "../../entities/rides.entity";
import { PaymentDetails } from "@libs/data-access/common/payment-details";
import { Fare } from "@libs/data-access/common/fare";
import { RideLocation } from "@libs/data-access/common/ride.location";
import { GeoLocation } from "@libs/data-access/common/geo.location";
import { Vehicle } from "@libs/data-access/entities/vehicle.entity";
import { RideStatus, RideTypes } from "@libs/data-access/enums/rides.enum";

@ObjectType()
export class RidesListResponse {
  @Field(() => [Rides])
  rides: Rides[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  page: number;

  @Field(() => Int)
  limit: number;
}

@ObjectType()
export class AdminRideUserSnapshot {
  @Field(() => String)
  userId: string;

  @Field(() => String, { nullable: true })
  fullName?: string;

  @Field(() => String, { nullable: true })
  displayId?: string;

  @Field(() => String, { nullable: true })
  email?: string;

  @Field(() => String, { nullable: true })
  phone?: string;

  @Field(() => String, { nullable: true })
  profileImage?: string;

  @Field(() => Number, { defaultValue: 0 })
  rating?: number;

  @Field(() => Boolean, { defaultValue: false })
  suspended?: boolean;

  @Field(() => Number, { nullable: true })
  totalTripsAsPassenger?: number;

  @Field(() => Number, { nullable: true })
  totalRidesAsDriver?: number;

  @Field(() => GeoLocation, { nullable: true })
  geoLocation?: GeoLocation;
}
@ObjectType()
export class RideDetailResponse {
  @Field(() => String)
  id: string;

  @Field(() => String, { nullable: true })
  rideUUId?: string;

  @Field(() => RideTypes)
  rideType: RideTypes;

  @Field(() => RideStatus)
  rideStatus: RideStatus;

  @Field(() => Date)
  bookingTime: Date;

  @Field(() => Date, { nullable: true })
  rideStartedAt?: Date;

  @Field(() => Date, { nullable: true })
  rideCompletedAt?: Date;

  @Field(() => RideLocation, { nullable: true })
  pickupLocation?: RideLocation;

  @Field(() => RideLocation, { nullable: true })
  dropoffLocation?: RideLocation;

  @Field(() => Number, { nullable: true })
  distanceInKm?: number;

  @Field(() => Number, { nullable: true })
  durationInMinutes?: number; // actualCompletedDurationInMinutes ?? estimatedTimeInMinutes

  @Field(() => Number, { nullable: true })
  waitTimeInMinutes?: number; // timeToReachPassengerInMinutes — TODO: confirm this maps to "wait time" in the mockup

  @Field(() => Fare, { nullable: true })
  fare?: Fare;

  @Field(() => PaymentDetails, { nullable: true })
  paymentDetails?: PaymentDetails;

  @Field(() => Float, { nullable: true })
  platformCommissionAmount?: number; // computed: totalAmount * driverCommission

  @Field(() => Float, { nullable: true })
  driverEarningsAmount?: number; // computed: totalAmount - platformCommissionAmount

  @Field(() => Vehicle, { nullable: true })
  vehicle?: Vehicle;

  @Field(() => AdminRideUserSnapshot, { nullable: true })
  driver?: AdminRideUserSnapshot;

  @Field(() => AdminRideUserSnapshot, { nullable: true })
  passenger?: AdminRideUserSnapshot;
}
