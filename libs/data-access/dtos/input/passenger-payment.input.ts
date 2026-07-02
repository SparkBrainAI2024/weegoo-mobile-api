import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { PaymentMethodEnum } from '../../enums/payment.enum';

@InputType()
export class PassengerPaymentInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  rideId: string;

  @Field(() => PaymentMethodEnum)
  @IsEnum(PaymentMethodEnum)
  @IsNotEmpty()
  paymentMethod: PaymentMethodEnum;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  promoCodeId?: string;
}