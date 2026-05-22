import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Transaction, TransactionDocument } from '../entities/transaction.entity';
import { TransactionDirection, TransactionStatus, TransactionType } from '../enums/transaction.enum';
import { PaymentMethodEnum } from '../enums/payment.enum';

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

  async findByRiderId(riderId: string): Promise<Transaction[]> {
    return this.model.find({ riderId }).sort({ createdAt: -1 });
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
  async earningsByDay(
    driverId: string,
    from: Date,
    to: Date,
  ): Promise<{ date: string; total: number }[]> {
    return this.model.aggregate([
      {
        $match: {
          driverId,
          direction: TransactionDirection.CREDIT,
          type: TransactionType.RIDE_PAYMENT,
          createdAt: { $gte: from, $lte: to },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$amount' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', total: 1, _id: 0 } },
    ]);
  }
}