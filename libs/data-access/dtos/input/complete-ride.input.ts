import { InputType, Field } from '@nestjs/graphql';
import { PaymentMethodEnum } from '../../enums/payment.enum';

@InputType()
export class CompleteRideInput {
  @Field(() => String, { description: 'The ride ID to complete' })
  rideId: string;

  @Field(() => PaymentMethodEnum, { nullable: true, description: 'Payment method used' })
  paymentMethod?: PaymentMethodEnum;
}