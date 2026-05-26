import { PaymentMethodEnum } from '@libs/data-access';
import { TransactionDirection, TransactionStatus, TransactionType } from '@libs/data-access/enums/transaction.enum';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
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
    //TODO private readonly walletRepo: WalletRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // called on trip confirmed — inserts 3 rows atomically
  async createRideTransactions(input: RideConfirmedInput): Promise<void> {
    const {
      tripId, 
      //TODO riderWalletId, driverWalletId, adminWalletId,
      
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
            status: TransactionStatus.PENDING
            
          },
          {
            tripId, riderId, driverId,
            direction: TransactionDirection.CREDIT,
            type: TransactionType.RIDE_PAYMENT,
            amount: driverCredit,
            paymentMethod,
            status: TransactionStatus.PENDING
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
        // cash → rows recorded for audit, balances untouched
        // TODO: if (paymentMethod === PaymentMethod.WALLET) {
        //   await this.walletRepo.decrementBalance(riderWalletId, totalAmount, session);
        //   await this.walletRepo.incrementBalance(driverWalletId, driverCredit, session);
        //   await this.walletRepo.incrementBalance(adminWalletId, commission, session);
        // }
      });
    } finally {
      await session.endSession();
    }
  }

    async getDriversEarningByDate(driverId: string) {
    const result = await this.transactionRepo.earningsByDayForDriver(driverId);

    return (
      result[0] || {
        totalCredit: 0,
        totalDebit: 0,
        netEarning: 0,
      }
    );
  }

}