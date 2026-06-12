import { InputType, Field } from '@nestjs/graphql';
import { PaymentMethodEnum } from '../../enums/payment.enum';
import { IsEnum, IsOptional, IsString } from 'class-validator';

@InputType()
export class CompleteRideInput {
  @Field(() => String, { description: 'The ride ID to complete' })
  @IsString()
  rideId: string;

  @Field(() => PaymentMethodEnum, { nullable: false, description: 'Payment method used' })
  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;
}