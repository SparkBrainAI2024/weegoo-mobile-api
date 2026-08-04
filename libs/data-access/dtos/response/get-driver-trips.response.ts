import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { Pagination } from '@libs/data-access/base/base.response';
import { RideLocation } from '@libs/data-access/common/ride.location';
import { Fare } from '@libs/data-access/common/fare';
import { PaymentDetails } from '@libs/data-access/common/payment-details';
import { DriverTripCommissionFilter } from '../input/get-driver-trips.input';

@ObjectType()
export class DriverTripItem {
  @Field(() => String)
  tripId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => RideLocation, { nullable: true })
  pickupLocation?: RideLocation;

  @Field(() => RideLocation, { nullable: true })
  dropoffLocation?: RideLocation;

  @Field(() => Fare, { nullable: true })
  fare?: Fare;

  @Field(() => PaymentDetails, { nullable: true })
  paymentDetails?: PaymentDetails;

  @Field(() => Float, { defaultValue: 0 })
  commission: number;

  @Field(() => DriverTripCommissionFilter, { nullable: true })
  commissionStatus?: DriverTripCommissionFilter;

  @Field(() => Date, { nullable: true })
  createdAt?: Date;
}

@ObjectType()
export class GetDriverTripsResponse {
  @Field(() => [DriverTripItem], { nullable: true })
  data: DriverTripItem[];

  @Field(() => Pagination)
  pagination: Pagination;

  @Field(() => Float, { defaultValue: 0 })
  walletAmount: number;

  @Field(() => Float, { defaultValue: 0 })
  totalCommission: number;
}
