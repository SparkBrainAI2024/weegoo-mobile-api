import { Field, Float, Int, ObjectType } from "@nestjs/graphql";
import { Pagination } from "@libs/data-access/base/base.response";
import { RideLocation } from "@libs/data-access/common/ride.location";
import { PaymentMethodEnum } from "@libs/data-access/enums/payment.enum";

@ObjectType()
export class DriverEarningHistoryItem {
  @Field(() => String)
  transactionId: string;

  @Field(() => String)
  tripId: string;

  @Field(() => RideLocation, { nullable: true })
  pickupLocation: RideLocation;

  @Field(() => RideLocation, { nullable: true })
  dropoffLocation: RideLocation;

  @Field(() => String, { nullable: true })
  rideStatus?: string;

  @Field(() => String, { nullable: true })
  rideUUId?: string;

  @Field(() => Float)
  amount: number;

  @Field(() => PaymentMethodEnum, { nullable: true })
  paymentMethod?: PaymentMethodEnum;

  @Field(() => String, { nullable: true })
  remarks?: string;

  @Field(() => Date)
  createdAt: Date;
}

@ObjectType()
export class DriverEarningHistoryResponse {
  @Field(() => [DriverEarningHistoryItem], { nullable: true })
  data: DriverEarningHistoryItem[];

  @Field(() => Pagination)
  pagination: Pagination;

  @Field(() => Float, { nullable: true, defaultValue: 0 })
  totalEarnings: number;
}