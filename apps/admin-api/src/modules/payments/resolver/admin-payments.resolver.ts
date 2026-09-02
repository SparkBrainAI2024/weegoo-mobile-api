import { Args, Query, Resolver } from "@nestjs/graphql";
import { PaymentsService } from "@libs/services/payment/src/payments/payment.service";
import {
  PaymentsOverviewInput,
  RecentTransactionsInput,
} from "@libs/data-access/dtos/input/payments.input";
import {
  PaymentsSummaryResponse,
  CommissionOverviewResponse,
  WalletBalancesResponse,
  TopupWithdrawalResponse,
  PaginatedTransactionsResponse,
  PendingWithdrawalsResponse,
} from "@libs/data-access/dtos/response/payments.response";

@Resolver()
export class PaymentsResolver {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Query(() => PaymentsSummaryResponse)
  async paymentsSummary(): Promise<PaymentsSummaryResponse> {
    return this.paymentsService.getPaymentsSummary();
  }

  @Query(() => CommissionOverviewResponse)
  async commissionOverview(
    @Args("input", { type: () => PaymentsOverviewInput, nullable: true })
    input: PaymentsOverviewInput = {},
  ): Promise<CommissionOverviewResponse> {
    return this.paymentsService.getCommissionOverview(input.period);
  }

  @Query(() => WalletBalancesResponse)
  async walletBalances(): Promise<WalletBalancesResponse> {
    return this.paymentsService.getWalletBalances();
  }

  @Query(() => TopupWithdrawalResponse)
  async topupVsWithdrawals(
    @Args("input", { type: () => PaymentsOverviewInput, nullable: true })
    input: PaymentsOverviewInput = {},
  ): Promise<TopupWithdrawalResponse> {
    return this.paymentsService.getTopupVsWithdrawals(input);
  }

  @Query(() => PaginatedTransactionsResponse)
  async recentTransactions(
    @Args("input", { type: () => RecentTransactionsInput, nullable: true })
    input: RecentTransactionsInput = {},
  ): Promise<PaginatedTransactionsResponse> {
    return this.paymentsService.getRecentTransactions(input);
  }

  @Query(() => PendingWithdrawalsResponse)
  async pendingWithdrawals(): Promise<PendingWithdrawalsResponse> {
    return this.paymentsService.getPendingWithdrawals();
  }
}
