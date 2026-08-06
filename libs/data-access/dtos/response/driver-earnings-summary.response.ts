import { Field, Float, Int, ObjectType } from '@nestjs/graphql';
import { PaymentMethodEnum, PaymentStatusEnum } from '@libs/data-access/enums/payment.enum';
import { RideLocation } from '@libs/data-access/common/ride.location';

@ObjectType()
export class PaymentBreakdown {
  @Field(() => Float, { defaultValue: 0 })
  cash: number;

  @Field(() => Float, { defaultValue: 0 })
  wallet: number;
}

@ObjectType()
export class RecentEarning {
  @Field(() => String)
  transactionId: string;

  @Field(() => String)
  tripId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => PaymentMethodEnum, { nullable: true })
  paymentMethod?: PaymentMethodEnum;

  @Field(() => Date)
  createdAt: Date;

  @Field(() => RideLocation, { nullable: true })
  pickupLocation?: RideLocation;

  @Field(() => RideLocation, { nullable: true })
  dropoffLocation?: RideLocation;

  @Field(() => PaymentStatusEnum, { nullable: true })
  paymentStatus?: PaymentStatusEnum;
}

@ObjectType()
export class DriverEarningsSummaryResponse {
  @Field(() => Float, { defaultValue: 0 })
  totalEarnings: number;

  @Field(() => Float, { defaultValue: 0 })
  netEarnings: number;

  @Field(() => Float, { defaultValue: 0 })
  commission: number;

  @Field(() => Int, { defaultValue: 0 })
  tripsCompleted: number;

  @Field(() => PaymentBreakdown)
  paymentBreakdown: PaymentBreakdown;

  @Field(() => Float, { defaultValue: 0 })
  averageEarning: number;

  @Field(() => Float, { defaultValue: 0 })
  totalOnlineHours: number;

  @Field(() => Float, { defaultValue: 0 })
  commissionDue: number;

  @Field(() => Int, { defaultValue: 0 })
  tripIncrease: number;

  @Field(() => [RecentEarning], { nullable: true })
  recentEarnings: RecentEarning[];
}
