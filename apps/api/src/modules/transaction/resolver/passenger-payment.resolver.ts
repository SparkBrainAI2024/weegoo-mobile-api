import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, PassengerPaymentInput, PassengerPaymentResponse } from '@libs/data-access';
import { PaymentMethodEnum } from '@libs/data-access/enums/payment.enum';
import { PassengerPaymentService } from '../passenger-payment.service';

@Resolver()
@UseGuards(AuthGuard)
export class PassengerPaymentResolver {
  constructor(private readonly paymentService: PassengerPaymentService) {}

  @Mutation(() => PassengerPaymentResponse, {
    name: 'processPayment',
    description: 'Process payment for a completed ride via WALLET or CASH. Optionally apply a promo code.',
  })
  async processPayment(
    @CurrentUser() user: User,
    @Args('input') input: PassengerPaymentInput,
  ): Promise<PassengerPaymentResponse> {
    const result = await this.paymentService.processPayment(
      input.rideId,
      user._id.toString(),
      input.paymentMethod as PaymentMethodEnum,
      input.promoCodeId || undefined,
    );

    return {
      success: result.success,
      message: result.message,
      rideId: result.rideId,
      rideUUId: result.rideUUId,
      paymentMethod: result.paymentMethod,
      fareBreakdown: result.fareBreakdown,
      transactions: result.transactions,
      paid: result.paid,
    };
  }
}