import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession, Types } from 'mongoose';
import { Transaction, TransactionDocument } from '../entities/transaction.entity';
import { TransactionDirection, TransactionStatus, TransactionType } from '../enums/transaction.enum';
import { PaymentMethodEnum, PaymentMediumEnum } from '../enums/payment.enum';
import { toMongoId } from '@libs/common';

export interface CreateTransactionDto {
  // TODOwalletId: string;
  tripId?: string;
  driverId?: string;
  riderId?: string;
  adminId?: string;
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
  ) { }

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

  async findByRiderId(riderId: string): Promise<Transaction[]> {
    return this.model.find({ riderId }).sort({ createdAt: -1 });
  }

  async findByUserIdPaginated(
    userId: string,
    field: 'driverId' | 'riderId',
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
    const filter = { $or: [{ 'riderId': toMongoId(userId) }, { 'driverId': toMongoId(userId) }], transationStatus: { $eq: TransactionStatus.COMPLETED } };
    const total = await this.model.countDocuments(filter);
    const data = await this.model
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(page * limit)
      .limit(limit);
    return { data, total };
  }

  async findByWalletId(
    walletId: string,
    limit = 10,
  ): Promise<Transaction[]> {
    return this.model
      .find({ walletId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  // reconciliation — sum credits and debits for a wallet
  async sumByWalletId(walletId: string): Promise<{ credits: number; debits: number }> {
    const result = await this.model.aggregate([
      { $match: { walletId } },
      {
        $group: {
          _id: '$direction',
          total: { $sum: '$amount' },
        },
      },
    ]);

    const credits = result.find((r) => r._id === TransactionDirection.CREDIT)?.total ?? 0;
    const debits = result.find((r) => r._id === TransactionDirection.DEBIT)?.total ?? 0;
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
              timezone: "Asia/Kathmandu"
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
}