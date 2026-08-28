import { Injectable } from "@nestjs/common";
import { TransactionRepository } from "../../../../data-access/repositories/transaction.repository";
import { WalletRepository } from "../../../../data-access/repositories/wallet.repository";
import {
  PaymentsOverviewInput,
  RecentTransactionsInput,
} from "../../../../data-access/dtos/input/payments.input";
import {
  PaymentsSummaryResponse,
  CommissionOverviewResponse,
  WalletBalancesResponse,
  TopupWithdrawalResponse,
  PaginatedTransactionsResponse,
  PendingWithdrawalsResponse,
} from "../../../../data-access/dtos/response/payments.response";
import {
  TransactionDirection,
  TransactionType,
  WalletUserType,
} from "../../../../data-access/enums/transaction.enum";
import {
  resolveDateRange,
  calcPercentChange,
} from "../../../../common/utils/payments-date-range.util";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly walletRepository: WalletRepository,
  ) {}

  async getPaymentsSummary(
    input: PaymentsOverviewInput,
  ): Promise<PaymentsSummaryResponse> {
    const { start, end, prevStart, prevEnd } = resolveDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );

    const [commission, prevCommission, totalTx, prevTotalTx, balances] =
      await Promise.all([
        this.transactionRepository.sumByType(
          TransactionType.COMMISSION,
          null,
          start,
          end,
        ),
        this.transactionRepository.sumByType(
          TransactionType.COMMISSION,
          null,
          prevStart,
          prevEnd,
        ),
        this.transactionRepository.countInRange(start, end),
        this.transactionRepository.countInRange(prevStart, prevEnd),
        this.walletRepository.getBalancesByRole(),
      ]);

    const driverBalance = balances.find((b) => b._id === "DRIVER")?.total ?? 0;
    const customerBalance =
      balances.find((b) => b._id === "CUSTOMER")?.total ?? 0;

    return {
      totalCommission: {
        value: commission,
        percentChange: calcPercentChange(commission, prevCommission),
        isIncrease: commission >= prevCommission,
      },
      driverWalletBalance: { value: driverBalance },
      customerWalletBalance: { value: customerBalance },
      totalTransactions: {
        value: totalTx,
        percentChange: calcPercentChange(totalTx, prevTotalTx),
        isIncrease: totalTx >= prevTotalTx,
      },
    };
  }

  async getCommissionOverview(
    input: PaymentsOverviewInput,
  ): Promise<CommissionOverviewResponse> {
    const { start, end, prevStart, prevEnd } = resolveDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );

    const [series, total, prevTotal] = await Promise.all([
      this.transactionRepository.getCommissionSeries(start, end),
      this.transactionRepository.sumByType(
        TransactionType.COMMISSION,
        null,
        start,
        end,
      ),
      this.transactionRepository.sumByType(
        TransactionType.COMMISSION,
        null,
        prevStart,
        prevEnd,
      ),
    ]);

    return {
      totalCommission: total,
      percentChange: calcPercentChange(total, prevTotal),
      series,
    };
  }

  async getWalletBalances(): Promise<WalletBalancesResponse> {
    const balances = await this.walletRepository.getBalancesByRole();
    const driver = balances.find((b) => b._id === "DRIVER")?.total ?? 0;
    const customer = balances.find((b) => b._id === "CUSTOMER")?.total ?? 0;

    // Commission segment mirrors the screenshot's donut; sourced from all
    // completed commission transactions (not a wallet balance).
    const commission = await this.transactionRepository.sumByType(
      TransactionType.COMMISSION,
      null,
      new Date(0),
      new Date(),
    );

    const total = driver + customer + commission;
    const pct = (val: number) =>
      total > 0 ? Number(((val / total) * 100).toFixed(1)) : 0;

    return {
      totalBalance: total,
      driverWallet: {
        label: "Driver Wallet Balance",
        value: driver,
        percentage: pct(driver),
      },
      customerWallet: {
        label: "Customer Wallet Balance",
        value: customer,
        percentage: pct(customer),
      },
      commission: {
        label: "Commission",
        value: commission,
        percentage: pct(commission),
      },
    };
  }

  async getTopupVsWithdrawals(
    input: PaymentsOverviewInput,
  ): Promise<TopupWithdrawalResponse> {
    const { start, end, prevStart, prevEnd } = resolveDateRange(
      input.period,
      input.startDate,
      input.endDate,
    );

    const [topups, prevTopups, withdrawals, prevWithdrawals, trend] =
      await Promise.all([
        this.transactionRepository.sumByType(
          TransactionType.TOPUP,
          TransactionDirection.CREDIT,
          start,
          end,
        ),
        this.transactionRepository.sumByType(
          TransactionType.TOPUP,
          TransactionDirection.CREDIT,
          prevStart,
          prevEnd,
        ),
        this.transactionRepository.sumByType(
          TransactionType.WITHDRAWAL,
          TransactionDirection.DEBIT,
          start,
          end,
        ),
        this.transactionRepository.sumByType(
          TransactionType.WITHDRAWAL,
          TransactionDirection.DEBIT,
          prevStart,
          prevEnd,
        ),
        this.transactionRepository.getNetFlowTrend(start, end),
      ]);

    const netFlow = topups - withdrawals;
    const prevNetFlow = prevTopups - prevWithdrawals;

    return {
      totalTopups: {
        value: topups,
        percentChange: calcPercentChange(topups, prevTopups),
        isIncrease: topups >= prevTopups,
      },
      totalWithdrawals: {
        value: withdrawals,
        percentChange: calcPercentChange(withdrawals, prevWithdrawals),
        isIncrease: withdrawals >= prevWithdrawals,
      },
      netFlow,
      netFlowPercentChange: calcPercentChange(netFlow, prevNetFlow),
      netFlowTrend: trend,
    };
  }

  async getRecentTransactions(
    input: RecentTransactionsInput,
  ): Promise<PaginatedTransactionsResponse> {
    const page = input.page ?? 0;
    const limit = input.limit ?? 5;

    const result =
      await this.transactionRepository.getRecentTransactionsPaginated(
        page,
        limit,
        {
          type: input.type,
          status: input.status,
        },
      );

    const data = result.data.map((tx: any) => {
      const isDriverParty = !!tx.driverId;
      const person = tx.driver ?? tx.rider;

      return {
        id: tx.transactionUuid ?? tx._id.toString(),
        type: tx.type,
        user: {
          userId: person?._id?.toString() ?? null,
          fullName: person?.fullName ?? null,
          displayId:
            (isDriverParty ? person?.driverSlugId : person?.passengerSlugId) ??
            null,
          userType: isDriverParty
            ? WalletUserType.DRIVER
            : WalletUserType.PASSENGER,
        },
        description: tx.remarks ?? null,
        amount: tx.amount,
        direction: tx.direction,
        status: tx.status,
        createdAt: tx.createdAt,
      };
    });

    const total = result.total; // was: result.pagination.total
    const hasNextPage = (page + 1) * limit < total; // was: result.pagination.hasNextPage

    return {
      data,
      total,
      page, // was: result.pagination.page
      limit, // was: result.pagination.limit
      hasNextPage,
      hasPreviousPage: page > 0, // was: result.pagination.hasPreviousPage
    };
  }

  async getPendingWithdrawals(): Promise<PendingWithdrawalsResponse> {
    const [rows, total] = await Promise.all([
      this.transactionRepository.getPendingWithdrawalRows(),
      this.transactionRepository.getPendingWithdrawalsTotal(),
    ]);

    const data = rows.map((tx: any) => ({
      id: tx._id.toString(),
      fullName: tx.driver?.fullName ?? null,
      displayId: tx.driver?.driverSlugId ?? null,
      amount: tx.amount,
      status: tx.status,
      requestedAt: tx.createdAt,
    }));

    return { data, totalPending: total };
  }
}
