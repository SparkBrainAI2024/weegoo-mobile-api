import { Field, ObjectType, Float } from '@nestjs/graphql';
import { PaymentMethodEnum } from '../../enums/payment.enum';

@ObjectType()
export class PaymentFareBreakdown {
  @Field(() => Float)
  baseFare: number;

  @Field(() => Float)
  distanceCharge: number;

  @Field(() => Float)
  discount: number;

  @Field(() => Float)
  totalFare: number;
}

@ObjectType()
export class PaymentTransactionDetail {
  @Field(() => String)
  transactionId: string;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  type: string;

  @Field(() => Float)
  amount: number;
}

@ObjectType()
export class PassengerPaymentResponse {
  @Field(() => Boolean)
  success: boolean;

  @Field(() => String)
  message: string;

  @Field(() => String)
  rideId: string;

  @Field(() => String)
  rideUUId: string;

  @Field(() => PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @Field(() => PaymentFareBreakdown)
  fareBreakdown: PaymentFareBreakdown;

  @Field(() => [PaymentTransactionDetail], { nullable: true })
  transactions?: PaymentTransactionDetail[];

  @Field(() => Boolean)
  paid: boolean;
}
