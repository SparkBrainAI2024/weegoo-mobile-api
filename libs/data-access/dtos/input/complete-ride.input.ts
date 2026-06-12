import { InputType, Field } from '@nestjs/graphql';
import { PaymentMethodEnum } from '../../enums/payment.enum';
import { IsOptional } from 'class-validator';

@InputType()
export class CompleteRideInput {
  @Field(() => String, { description: 'The ride ID to complete' })
  rideId: string;

  @Field(() => PaymentMethodEnum, { nullable: false, description: 'Payment method used' })
  paymentMethod: PaymentMethodEnum;
}