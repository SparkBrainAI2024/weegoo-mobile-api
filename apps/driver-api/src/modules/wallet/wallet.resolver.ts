import { Resolver, Query, Mutation, Args, ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard, RoleGuard } from '@libs/guards';
import { CurrentUser } from '@libs/common';
import { User, roles } from '@libs/data-access';
import { WalletService } from '@libs/services/payment/src/wallet/wallet.service';
import { Wallet } from '@libs/data-access/entities/wallet.entity';
import { PaymentMethodEnum, PaymentMediumEnum } from '@libs/data-access/enums/payment.enum';
import { GraphQLJSON } from 'graphql-scalars';

// ── Response DTOs ──────────────────────────────────────────────────────────

@ObjectType()
export class TopupInitiateResponse {
  @Field(() => String)
  transactionId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  status: string;

  @Field(() => GraphQLJSON, { nullable: true })
  esewaPayload?: Record<string, any>;

  @Field(() => GraphQLJSON, { nullable: true })
  khaltiPayload?: Record<string, any>;

  @Field(() => String, { nullable: true })
  gatewayUrl?: string;

  @Field(() => String)
  successUrl: string;

  @Field(() => String)
  failureUrl: string;
}

@ObjectType()
export class WithdrawInitiateResponse {
  @Field(() => String)
  transactionId: string;

  @Field(() => Float)
  amount: number;

  @Field(() => String)
  status: string;
}

@Resolver()
@UseGuards(AuthGuard, RoleGuard)
@SetMetadata('roles', [roles.RIDER])
export class WalletResolver {
  constructor(private readonly walletService: WalletService) {}

  @Query(() => Wallet, {
    name: 'getMyWallet',
    description: 'Get the wallet (including balance) for the logged-in driver',
  })
  async getMyWallet(@CurrentUser() user: User): Promise<Wallet> {
    return this.walletService.getWallet(user._id.toString());
  }

  // ── Topup: Step 1 – Initiate ──────────────────────────────────
  @Mutation(() => TopupInitiateResponse, {
    name: 'initiateTopup',
    description:
      'Step 1: Initiate a topup via eSewa or Khalti. Provide paymentMedium (ESEWA or KHALTI). Returns transaction ID + gateway payload. The frontend uses this to redirect the user.',
  })
  async initiateTopup(
    @CurrentUser() user: User,
    @Args('amount', { type: () => Float }) amount: number,
    @Args('paymentMedium', { type: () => PaymentMediumEnum })
    paymentMedium: PaymentMediumEnum,
  ): Promise<TopupInitiateResponse> {
    return this.walletService.initiateTopup({
      userId: user._id.toString(),
      amount,
      paymentMethod: PaymentMethodEnum.WALLET,
      paymentMedium,
      loginAs: user.loginAs,
    });
  }

  // ── Topup: Step 2 – Complete (redirect callback) ───────────
  @Mutation(() => String, {
    name: 'completeTopup',
    description:
      'Called by the frontend after the payment gateway redirects to the success URL. Verifies the transaction and credits the wallet.',
  })
  async completeTopup(
    @Args('transactionId', { type: () => String }) transactionId: string,
    @Args('verifiedAmount', { type: () => Float }) verifiedAmount: number,
  ): Promise<string> {
    await this.walletService.completeTopup(transactionId, verifiedAmount);
    return 'Topup completed successfully';
  }

  // ── Topup: Failure callback ───────────────────────────────────
  @Mutation(() => String, {
    name: 'failTopup',
    description:
      'Called when the payment gateway redirects to the failure URL. Marks the transaction as FAILED.',
  })
  async failTopup(
    @Args('transactionId', { type: () => String }) transactionId: string,
  ): Promise<string> {
    await this.walletService.failTopup(transactionId);
    return 'Topup failed';
  }

  // ── Withdraw: Step 1 – Initiate ───────────────────────────────
  @Mutation(() => WithdrawInitiateResponse, {
    name: 'initiateWithdraw',
    description:
      'Initiate a wallet withdrawal. Creates a PENDING withdrawal transaction that must be approved by admin.',
  })
  async initiateWithdraw(
    @CurrentUser() user: User,
    @Args('amount', { type: () => Float }) amount: number,
  ): Promise<WithdrawInitiateResponse> {
    return this.walletService.initiateWithdraw({
      userId: user._id.toString(),
      amount,
      paymentMethod: PaymentMethodEnum.WALLET,
      loginAs: user.loginAs,
    });
  }
}