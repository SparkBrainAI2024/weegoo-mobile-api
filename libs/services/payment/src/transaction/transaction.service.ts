import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { TransactionRepository } from '../transaction-persistence/transaction.repository';
import { WalletRepository } from '../wallet-persistence/wallet.repository';
import { TransactionDirection, TransactionType, PaymentMethod } from '../../common/enums';

export interface RidePaymentInput {
  tripId: string;
  riderWalletId: string;
  driverWalletId: string;
  adminWalletId: string;
  riderId: string;
  driverId: string;
  adminId: string;
  totalAmount: number;
  commission: number;
  paymentMethod: PaymentMethod;
}

@Injectable()
export class TransactionService {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly walletRepo: WalletRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // called on trip completion — inserts 3 rows atomically
  async createRideTransactions(input: RidePaymentInput): Promise<void> {
    const {
      tripId, riderWalletId, driverWalletId, adminWalletId,
      riderId, driverId, adminId,
      totalAmount, commission, paymentMethod,
    } = input;

    const driverCredit = totalAmount - commission;
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        // insert all 3 rows as completed directly — no pending state
        await this.transactionRepo.createMany([
          {
            walletId: riderWalletId,
            tripId, riderId, driverId,
            direction: TransactionDirection.DEBIT,
            type: TransactionType.RIDE_PAYMENT,
            amount: totalAmount,
            paymentMethod,
          },
          {
            walletId: driverWalletId,
            tripId, riderId, driverId,
            direction: TransactionDirection.CREDIT,
            type: TransactionType.RIDE_PAYMENT,
            amount: driverCredit,
            paymentMethod,
          },
          {
            walletId: adminWalletId,
            tripId, driverId, adminId,
            direction: TransactionDirection.CREDIT,
            type: TransactionType.COMMISSION,
            amount: commission,
            paymentMethod,
          },
        ], session);

        // only move actual balances for wallet payment
        // cash → rows recorded for audit, balances untouched
        if (paymentMethod === PaymentMethod.WALLET) {
          await this.walletRepo.decrementBalance(riderWalletId, totalAmount, session);
          await this.walletRepo.incrementBalance(driverWalletId, driverCredit, session);
          await this.walletRepo.incrementBalance(adminWalletId, commission, session);
        }
      });
    } finally {
      await session.endSession();
    }
  }
}