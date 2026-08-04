import { PaymentMethodEnum, Transaction } from "@libs/data-access";
import { UserDailyOnlineStatusRepository } from "@libs/data-access/repositories/user-daily-online-status.repository";
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from "@libs/data-access/enums/transaction.enum";
import { TransactionRepository } from "@libs/data-access/repositories/transaction.repository";
import { WalletService } from "../wallet/wallet.service";
import { IPagination } from "@libs/data-access/interfaces/pagination.interface";
import { Injectable } from "@nestjs/common";
import { InjectConnection } from "@nestjs/mongoose";
import { Connection, Types } from "mongoose";
import { EarningsPeriod } from "@libs/data-access/dtos/input/driver-earnings-summary.input";

export interface RideConfirmedInput {
  tripId: string;
  //TODO riderWalletId: string;
  // driverWalletId: string;
  // adminWalletId: string;
  riderId: string;
  driverId: string;
  adminId: string;
  totalFare: number;
  commission: number;
  paymentMethod?: PaymentMethodEnum;
}

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly walletService: WalletService,
    private readonly userDailyOnlineStatusRepository: UserDailyOnlineStatusRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // called on trip confirmed — inserts 3 rows and moves wallet balances if WALLET payment
  async createRideTransactions(input: RideConfirmedInput): Promise<void> {
    const {
      tripId,
      riderId,
      driverId,
      adminId,
      totalFare,
      commission,
      paymentMethod,
    } = input;

    const driverCredit = totalFare - commission;
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // insert all 3 rows as completed directly — no pending state
        await this.transactionRepo.createMany(
          [
            {
              tripId,
              riderId,
              driverId,
              direction: TransactionDirection.DEBIT,
              type: TransactionType.RIDE_PAYMENT,
              amount: totalFare,
              paymentMethod,
              status: TransactionStatus.COMPLETED,
            },
            {
              tripId,
              riderId,
              driverId,
              direction: TransactionDirection.CREDIT,
              type: TransactionType.RIDE_PAYMENT,
              amount: driverCredit,
              paymentMethod,
              status: TransactionStatus.COMPLETED,
            },
            {
              tripId,
              driverId,
              adminId,
              direction: TransactionDirection.CREDIT,
              type: TransactionType.COMMISSION,
              amount: commission,
              paymentMethod,
              status: TransactionStatus.COMPLETED,
            },
          ],
          session,
        );

        // only move actual balances for wallet payment
        if (paymentMethod === PaymentMethodEnum.WALLET) {
          await this.walletService.processRideWalletPayment({
            riderId,
            driverId,
            adminId,
            totalFare,
            commission,
            tripId,
          });
        }
      });
    } finally {
      await session.endSession();
    }
  }

  async getTransactionHistory(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: Transaction[];
    pagination: IPagination;
    walletAmount: number;
  }> {
    const { data, total } = await this.transactionRepo.findByUserIdPaginatedV2(
      userId,
      page,
      limit,
    );

    const walletAmount = await this.walletService.getBalance(userId);

    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages - 1;
    const hasPreviousPage = page > 0;

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : undefined,
        previousPage: hasPreviousPage ? page - 1 : undefined,
      },
      walletAmount,
    };
  }

  async getDriversEarningByDate(driverId: string) {
    const result = await this.transactionRepo.earningsByDayForDriver(driverId);

    return (
      result[0] || {
        netEarning: 0,
      }
    );
  }

  async getDriverEarningHistory(
    driverId: string,
    page: number,
    limit: number,
  ): Promise<{
    data: any[];
    total: number;
    totalEarnings: number;
    pagination: IPagination;
  }> {
    const result = await this.transactionRepo.findDriverEarningHistory(
      driverId,
      page,
      limit,
    );

    const totalPages = Math.ceil(result.total / limit);
    const hasNextPage = page < totalPages - 1;
    const hasPreviousPage = page > 0;

    return {
      data: result.data,
      total: result.total,
      totalEarnings: result.totalEarnings,
      pagination: {
        page,
        limit,
        total: result.total,
        hasNextPage,
        hasPreviousPage,
        nextPage: hasNextPage ? page + 1 : undefined,
        previousPage: hasPreviousPage ? page - 1 : undefined,
      },
    };
  }

  async getDriverEarningsSummary(
    driverId: string,
    input: { period: EarningsPeriod; fromDate?: Date; toDate?: Date },
  ): Promise<any> {0
    const { from, to, previousFrom, previousTo } =
      this.calculatePeriodRange(input);

    const [current, previous] = await Promise.all([
      this.transactionRepo.getDriverEarningsSummary(driverId, from, to),
      this.transactionRepo.getDriverEarningsSummary(
        driverId,
        previousFrom,
        previousTo,
      ),
    ]);

    const totalOnlineHours = await this.getTotalOnlineHours(driverId, from, to);

    // Trip increase = current period completed trips minus previous period completed trips
    const tripIncrease = current.tripsCompleted - previous.tripsCompleted;

    return {
      totalEarnings: current.totalEarnings,
      netEarnings: current.netEarnings,
      commission: current.commission,
      tripsCompleted: current.tripsCompleted,
      paymentBreakdown: {
        cash: current.cashEarnings,
        wallet: current.walletEarnings,
      },
      averageEarning: current.averageEarning,
      totalOnlineHours,
      commissionDue: current.commissionDue,
      recentEarnings: current.recentEarnings,
      tripIncrease,
    };
  }

  private calculatePeriodRange(input: {
    period: EarningsPeriod;
    fromDate?: Date;
    toDate?: Date;
  }): { from: Date; to: Date; previousFrom: Date; previousTo: Date } {
    const now = new Date();
    let from: Date;
    let to: Date;
    let previousFrom: Date;
    let previousTo: Date;

    // If explicit fromDate/toDate are provided, use them regardless of period
    if (input.fromDate && input.toDate) {
      from = new Date(input.fromDate);
      from.setHours(0, 0, 0, 0);
      to = new Date(input.toDate);
      to.setHours(23, 59, 59, 999);
      const durationMs = to.getTime() - from.getTime();
      previousTo = new Date(from);
      previousTo.setDate(previousTo.getDate() - 1);
      previousTo.setHours(23, 59, 59, 999);
      previousFrom = new Date(previousTo.getTime() - durationMs);
      previousFrom.setHours(0, 0, 0, 0);
      return { from, to, previousFrom, previousTo };
    }

    switch (input.period) {
      case EarningsPeriod.TODAY: {
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - 1);
        previousTo = new Date(to);
        previousTo.setDate(previousTo.getDate() - 1);
        break;
      }
      case EarningsPeriod.WEEK: {
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        from = new Date(now);
        from.setDate(now.getDate() + diffToMonday);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - 7);
        previousTo = new Date(from);
        previousTo.setDate(previousTo.getDate() - 1);
        previousTo.setHours(23, 59, 59, 999);
        break;
      }
      case EarningsPeriod.MONTH: {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        previousFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        previousFrom.setHours(0, 0, 0, 0);
        previousTo = new Date(from);
        previousTo.setDate(previousTo.getDate() - 1);
        previousTo.setHours(23, 59, 59, 999);
        break;
      }
      case EarningsPeriod.CUSTOM: {
        from = input.fromDate ? new Date(input.fromDate) : new Date(now);
        from.setHours(0, 0, 0, 0);
        to = input.toDate ? new Date(input.toDate) : new Date(now);
        to.setHours(23, 59, 59, 999);
        const durationMs = to.getTime() - from.getTime();
        previousTo = new Date(from);
        previousTo.setDate(previousTo.getDate() - 1);
        previousTo.setHours(23, 59, 59, 999);
        previousFrom = new Date(previousTo.getTime() - durationMs);
        previousFrom.setHours(0, 0, 0, 0);
        break;
      }
      default: {
        from = new Date(now);
        from.setHours(0, 0, 0, 0);
        to = new Date(now);
        to.setHours(23, 59, 59, 999);
        previousFrom = new Date(from);
        previousFrom.setDate(previousFrom.getDate() - 1);
        previousTo = new Date(to);
        previousTo.setDate(previousTo.getDate() - 1);
      }
    }

    return { from, to, previousFrom, previousTo };
  }

  private async getTotalOnlineHours(
    driverId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const startDate = this.formatDate(from);
    const endDate = this.formatDate(to);

    const statuses = await this.userDailyOnlineStatusRepository.find({
      userId: new Types.ObjectId(driverId),
      date: { $gte: startDate, $lte: endDate },
    });

    if (!statuses.length) return 0;

    const totalSeconds = statuses.reduce(
      (sum, s) => sum + (s.totalOnlineSeconds || 0),
      0,
    );

    return Math.round((totalSeconds / 3600) * 100) / 100;
  }

  private formatDate(date: Date): string {
    // Use local date part to match the stored 'YYYY-MM-DD' online-status date string
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}
