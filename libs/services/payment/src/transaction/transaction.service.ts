import { PaymentMethodEnum, Transaction } from '@libs/data-access';
import { TransactionDirection, TransactionStatus, TransactionType } from '@libs/data-access/enums/transaction.enum';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
import { WalletService } from '../wallet/wallet.service';
import { IPagination } from '@libs/data-access/interfaces/pagination.interface';
import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';


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
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // called on trip confirmed — inserts 3 rows and moves wallet balances if WALLET payment
  async createRideTransactions(input: RideConfirmedInput): Promise<void> {
    const {
      tripId, 
      riderId, driverId, adminId,
      totalFare, commission, paymentMethod,
    } = input;

    const driverCredit = totalFare - commission;
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // insert all 3 rows as completed directly — no pending state
        await this.transactionRepo.createMany([
          {
            tripId, riderId, driverId,
            direction: TransactionDirection.DEBIT,
            type: TransactionType.RIDE_PAYMENT,
            amount: totalFare,
            paymentMethod,
            status: TransactionStatus.COMPLETED
            
          },
          {
            tripId, riderId, driverId,
            direction: TransactionDirection.CREDIT,
            type: TransactionType.RIDE_PAYMENT,
            amount: driverCredit,
            paymentMethod,
            status: TransactionStatus.COMPLETED
          },
          {
            tripId, driverId, adminId,
            direction: TransactionDirection.CREDIT,
            type: TransactionType.COMMISSION,
            amount: commission,
            paymentMethod,
            status: TransactionStatus.COMPLETED
          },
        ], session);

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
    role: 'rider' | 'driver',
    page: number,
    limit: number,
  ): Promise<{ data: Transaction[]; pagination: IPagination; walletAmount: number }> {
    const field = role === 'driver' ? 'driverId' : 'riderId';
    const { data, total } = await this.transactionRepo.findByUserIdPaginated(
      userId,
      field,
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

}