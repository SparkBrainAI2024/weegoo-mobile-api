import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, ClientSession, Types } from "mongoose";
import {
  Transaction,
  TransactionDocument,
} from "../entities/transaction.entity";
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from "../enums/transaction.enum";
import {
  PaymentMethodEnum,
  PaymentMediumEnum,
  TimeRangeFilter,
} from "../enums/payment.enum";
import { RideStatus } from "../enums/rides.enum";
import { toMongoId } from "@libs/common";
import {
  buildDateBuckets,
  Granularity,
} from "@libs/common/utils/payments-date-range.util";
import { ChartPoint } from "../dtos/response/payments.response";

export interface CreateTransactionDto {
  // TODOwalletId: string;
  tripId?: string;
  driverId?: string;
  riderId?: string;
  adminId?: string;
  transactionUuid?: string;
  direction: TransactionDirection;
  type: TransactionType;
  amount: number;
  paymentMethod?: PaymentMethodEnum;
  paymentMedium?: PaymentMediumEnum;
  reference?: string;
  status?: TransactionStatus;
}

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectModel(Transaction.name)
    private readonly model: Model<TransactionDocument>,
  ) {}

  async createMany(
    transactions: CreateTransactionDto[],
    session?: ClientSession,
  ): Promise<Transaction[]> {
    const docs = await this.model.insertMany(transactions, { session });
    return docs as unknown as Transaction[];
  }

  async findByDriverId(
    driverId: string,
    from: Date,
    to: Date,
  ): Promise<Transaction[]> {
    return this.model.find({
      driverId,
      direction: TransactionDirection.CREDIT,
      type: TransactionType.RIDE_PAYMENT,
      createdAt: { $gte: from, $lte: to },
    });
  }

  async totalEarningsByDriverId(driverId: string): Promise<number> {
    const result = await this.model.aggregate([
      {
        $match: {
          driverId: new Types.ObjectId(driverId),
          direction: TransactionDirection.CREDIT,
          type: TransactionType.RIDE_PAYMENT,
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$amount" },
        },
      },
    ]);
    return result[0]?.totalEarnings || 0;
  }

  async findByRiderId(riderId: string): Promise<Transaction[]> {
    return this.model.find({ riderId }).sort({ createdAt: -1 });
  }

  async findByUserIdPaginated(
    userId: string,
    field: "driverId" | "riderId",
    page: number,
    limit: number,
  ): Promise<{ data: Transaction[]; total: number }> {
    const filter = { [field]: userId, deleted: { $ne: true } };
    const total = await this.model.countDocuments(filter);
    const data = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);
    return { data, total };
  }

  async findByUserIdPaginatedV2(
    userId: string,
    page: number,
    limit: number,
  ): Promise<{ data: Transaction[]; total: number }> {
    const filter = {
      $or: [{ riderId: toMongoId(userId) }, { driverId: toMongoId(userId) }],
      status: { $eq: TransactionStatus.COMPLETED },
    };
    const total = await this.model.countDocuments(filter);
    const data = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);
    return { data, total };
  }

  async findByWalletId(walletId: string, limit = 10): Promise<Transaction[]> {
    return this.model.find({ walletId }).sort({ createdAt: -1 }).limit(limit);
  }

  async getDriverEarningsSummary(
    driverId: string,
    from: Date,
    to: Date,
  ): Promise<{
    totalEarnings: number;
    netEarnings: number;
    commission: number;
    tripsCompleted: number;
    cashEarnings: number;
    walletEarnings: number;
    averageEarning: number;
    commissionDue: number;
    recentEarnings: any[];
  }> {
    const driverObjectId = new Types.ObjectId(driverId);

    // Main summary: filter transactions to only those belonging to
    // completed rides for this driver within the given date range.
    const [result] = await this.model.aggregate([
      // All transactions for this driver
      { $match: { driverId: driverObjectId } },
      // Join with completed rides for this driver within the period
      {
        $lookup: {
          from: "rides",
          let: { tripId: "$tripId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$tripId"] },
                    { $eq: ["$driverId", driverObjectId] },
                    { $eq: ["$rideStatus", RideStatus.COMPLETED] },
                    {
                      $gte: [
                        { $ifNull: ["$rideCompletedAt", "$createdAt"] },
                        from,
                      ],
                    },
                    {
                      $lte: [
                        { $ifNull: ["$rideCompletedAt", "$createdAt"] },
                        to,
                      ],
                    },
                  ],
                },
              },
            },
          ],
          as: "ride",
        },
      },
      { $unwind: { path: "$ride", preserveNullAndEmptyArrays: true } },
      // Keep only transactions belonging to completed rides in the period
      { $match: { "ride._id": { $exists: true } } },
      {
        $facet: {
          // Completed ride payment credits → earnings
          credits: [
            {
              $match: {
                direction: TransactionDirection.CREDIT,
                type: TransactionType.RIDE_PAYMENT,
                status: TransactionStatus.COMPLETED,
              },
            },
            {
              $group: {
                _id: null,
                totalEarnings: { $sum: "$amount" },
                trips: { $addToSet: "$tripId" },
                cash: {
                  $sum: {
                    $cond: [
                      { $eq: ["$paymentMethod", PaymentMethodEnum.CASH] },
                      "$amount",
                      0,
                    ],
                  },
                },
                wallet: {
                  $sum: {
                    $cond: [
                      { $eq: ["$paymentMethod", PaymentMethodEnum.WALLET] },
                      "$amount",
                      0,
                    ],
                  },
                },
                avgEarning: { $avg: "$amount" },
              },
            },
          ],
          // Single most recent earning with ride details
          recent: [
            {
              $match: {
                direction: TransactionDirection.CREDIT,
                type: TransactionType.RIDE_PAYMENT,
                status: TransactionStatus.COMPLETED,
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
            {
              $project: {
                transactionId: "$_id",
                tripId: 1,
                amount: 1,
                paymentMethod: 1,
                createdAt: 1,
                pickupLocation: "$ride.pickupLocation",
                dropoffLocation: "$ride.dropoffLocation",
                paymentStatus: "$ride.paymentDetails.paymentStatus",
              },
            },
          ],
        },
      },
    ]);

    const credits = result?.credits?.[0] || {};

    // Trip IDs of the completed rides in this period
    const tripIds = credits.trips || [];

    // Commission totals for the SAME trip IDs — matched by ride id only,
    // NOT by driverId, since commission transactions carry tripId reliably.
    let totalCommission = 0;
    let commissionDue = 0;
    if (tripIds.length > 0) {
      const commissionResults = await this.model.aggregate([
        {
          $match: {
            direction: TransactionDirection.CREDIT,
            type: TransactionType.COMMISSION,
            tripId: { $in: tripIds },
          },
        },
        {
          $group: {
            _id: "$status",
            total: { $sum: "$amount" },
          },
        },
      ]);

      for (const row of commissionResults) {
        if (row._id === TransactionStatus.PENDING) {
          commissionDue = row.total || 0;
        }
      }

      totalCommission = commissionResults.reduce(
        (sum, row) => sum + (row.total || 0),
        0,
      );
    }

    const round2 = (value: number) => Math.round(value * 100) / 100;

    return {
      totalEarnings: credits.totalEarnings || 0,
      netEarnings: round2((credits.totalEarnings || 0) - totalCommission),
      commission: round2(totalCommission),
      tripsCompleted: credits.trips?.length || 0,
      cashEarnings: credits.cash || 0,
      walletEarnings: credits.wallet || 0,
      averageEarning: credits.avgEarning || 0,
      commissionDue: round2(commissionDue),
      recentEarnings: result?.recent || [],
    };
  }

  async findDriverEarningHistory(
    driverId: string,
    page: number,
    limit: number,
  ): Promise<{ data: any[]; total: number; totalEarnings: number }> {
    const filter = {
      driverId: new Types.ObjectId(driverId),
      direction: TransactionDirection.CREDIT,
      type: TransactionType.RIDE_PAYMENT,
      status: TransactionStatus.COMPLETED,
    };

    const totalAgg = await this.model.aggregate([
      { $match: filter },
      { $group: { _id: null, totalEarnings: { $sum: "$amount" } } },
    ]);

    const totalEarnings = totalAgg[0]?.totalEarnings || 0;

    const data = await this.model.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "rides",
          localField: "tripId",
          foreignField: "_id",
          as: "ride",
        },
      },
      { $unwind: { path: "$ride", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          transactionId: "$_id",
          tripId: 1,
          amount: 1,
          paymentMethod: 1,
          paymentStatus: "$status",
          remarks: 1,
          createdAt: 1,
          rideStatus: "$ride.rideStatus",
          rideUUId: "$ride.rideUUId",
          pickupLocation: "$ride.pickupLocation",
          dropoffLocation: "$ride.dropoffLocation",
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: page * limit },
      { $limit: limit },
    ]);

    const total = await this.model.countDocuments(filter);

    return {
      data,
      total,
      totalEarnings,
    };
  }

  // reconciliation — sum credits and debits for a wallet
  async sumByWalletId(
    walletId: string,
  ): Promise<{ credits: number; debits: number }> {
    const result = await this.model.aggregate([
      { $match: { walletId } },
      {
        $group: {
          _id: "$direction",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const credits =
      result.find((r) => r._id === TransactionDirection.CREDIT)?.total ?? 0;
    const debits =
      result.find((r) => r._id === TransactionDirection.DEBIT)?.total ?? 0;
    return { credits, debits };
  }

  // driver earnings aggregated by day for chart
  async earningsByDayForDriver(
    driverId: string,
    from?: Date,
    to?: Date,
  ): Promise<{ date: string; netEarning: number }[]> {
    const startDate = from || new Date();
    startDate.setHours(0, 0, 0, 0);

    const endDate = to || new Date();
    endDate.setHours(23, 59, 59, 999);

    const response = await this.model.aggregate([
      {
        $match: {
          driverId: new Types.ObjectId(driverId),
          direction: TransactionDirection.CREDIT,
          type: TransactionType.RIDE_PAYMENT,
          createdAt: {
            $gte: startDate,
            $lte: endDate,
          },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kathmandu",
            },
          },
          netEarning: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: "$_id",
          netEarning: 1,
        },
      },
    ]);
    return response;
  }
  async findOne(filter: Partial<Transaction>): Promise<Transaction | null> {
    return this.model.findOne(filter).exec();
  }
  // ── Payments dashboard ──────────────────────────────────────────────────

  async sumByType(
    type: TransactionType,
    direction: TransactionDirection | null,
  ): Promise<number> {
    const match: any = {
      type,
      status: TransactionStatus.COMPLETED,
      deleted: { $ne: true },
    };
    if (direction) match.direction = direction;

    const result = await this.model.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total ?? 0;
  }
  async sumByTypeWithDate(
    type: TransactionType,
    direction: TransactionDirection | null,
    start: Date,
    end: Date,
  ): Promise<number> {
    const match: any = {
      type,
      status: TransactionStatus.COMPLETED,
      deleted: { $ne: true },
      createdAt: { $gte: start, $lte: end },
    };
    if (direction) match.direction = direction;

    const result = await this.model.aggregate([
      { $match: match },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total ?? 0;
  }
  async countInRange(): Promise<number> {
    return this.model.countDocuments({
      deleted: { $ne: true },
    });
  }

  async getCommissionOverviewRepo(filter: TimeRangeFilter) {
    const { start, end, granularity, labels, keys } = buildDateBuckets(filter);
    const dateFormat = granularity === "day" ? "%Y-%m-%d" : "%Y-%m";

    const results = await this.model.aggregate([
      {
        $match: {
          type: TransactionType.COMMISSION,
          status: TransactionStatus.COMPLETED,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          total: { $sum: "$amount" },
        },
      },
    ]);

    const map = new Map(results.map((r) => [r._id, r.total]));
    const dataPoints = keys.map((key, i) => ({
      date: labels[i],
      amount: map.get(key) ?? 0,
    }));
    const totalCommission = dataPoints.reduce((s, p) => s + p.amount, 0);

    return { totalCommission, dataPoints };
  }

  async getCommissionSeries(
    start: Date,
    end: Date,
  ): Promise<{ date: string; amount: number }[]> {
    return this.model.aggregate([
      {
        $match: {
          type: TransactionType.COMMISSION,
          status: TransactionStatus.COMPLETED,
          createdAt: { $gte: start, $lte: end },
          deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kathmandu",
            },
          },
          amount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", amount: 1 } },
    ]);
  }

  async getNetFlowTrend(): Promise<{ date: string; amount: number }[]> {
    return this.model.aggregate([
      {
        $match: {
          type: { $in: [TransactionType.TOPUP, TransactionType.WITHDRAWAL] },
          status: TransactionStatus.COMPLETED,
          deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kathmandu",
            },
          },
          net: {
            $sum: {
              $cond: [
                { $eq: ["$type", TransactionType.TOPUP] },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, date: "$_id", amount: "$net" } },
    ]);
  }

  async getNetFlowTrendWithDate(
    start: Date,
    end: Date,
    granularity: Granularity,
    keys: string[],
  ): Promise<ChartPoint[]> {
    const dateFormat = granularity === "day" ? "%Y-%m-%d" : "%Y-%m";

    const results = await this.model.aggregate([
      {
        $match: {
          type: { $in: [TransactionType.TOPUP, TransactionType.WITHDRAWAL] },
          status: TransactionStatus.COMPLETED,
          deleted: { $ne: true },
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$createdAt" } },
          net: {
            $sum: {
              $cond: [
                { $eq: ["$direction", TransactionDirection.CREDIT] },
                "$amount",
                { $multiply: ["$amount", -1] },
              ],
            },
          },
        },
      },
    ]);

    const map = new Map(results.map((r) => [r._id, r.net]));
    return keys.map((key) => ({ date: key, amount: map.get(key) ?? 0 }));
  }
  async getPendingWithdrawalRows(limit = 10): Promise<any[]> {
    return this.model.aggregate([
      {
        $match: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          deleted: { $ne: true },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "userdetails",
          localField: "driverId",
          foreignField: "userId",
          as: "driver",
        },
      },
      { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
    ]);
  }

  async getPendingWithdrawalsTotal(): Promise<number> {
    const result = await this.model.aggregate([
      {
        $match: {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          deleted: { $ne: true },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    return result[0]?.total ?? 0;
  }

  async getRecentTransactionsPaginated(
    page: number,
    limit: number,
    filter: { type?: TransactionType; status?: TransactionStatus } = {},
  ): Promise<{ data: any[]; total: number }> {
    const match: any = { deleted: { $ne: true } };
    if (filter.type) match.type = filter.type;
    if (filter.status) match.status = filter.status;

    const basePipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: "userdetails",
          localField: "driverId",
          foreignField: "userId",
          as: "driver",
        },
      },
      { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "userdetails",
          localField: "riderId",
          foreignField: "userId",
          as: "rider",
        },
      },
      { $unwind: { path: "$rider", preserveNullAndEmptyArrays: true } },
    ];

    const [data, countResult] = await Promise.all([
      this.model.aggregate([
        ...basePipeline,
        { $sort: { createdAt: -1 } },
        { $skip: page * limit },
        { $limit: limit },
      ]),
      this.model.aggregate([...basePipeline, { $count: "count" }]),
    ]);

    return { data, total: countResult[0]?.count ?? 0 };
  }
}
