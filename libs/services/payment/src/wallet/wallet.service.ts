import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { WalletRepository } from '../wallet-persistence/wallet.repository';
import { TransactionRepository } from '../transaction-persistence/transaction.repository';
import { Wallet } from '../wallet-persistence/wallet.schema';
import { TransactionDirection, TransactionType, PaymentMethod, WalletUserType } from '../../common/enums';

@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly transactionRepo: TransactionRepository,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async getWalletByUserId(userId: string): Promise<Wallet> {
    const wallet = await this.walletRepo.findByUserId(userId);
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }

  async createWallet(userId: string, userType: WalletUserType): Promise<Wallet> {
    return this.walletRepo.createWallet(userId, userType);
  }

  async topUp(userId: string, amount: number, reference: string): Promise<Wallet> {
    if (amount < 50) {
      throw new BadRequestException('Minimum top-up amount is Rs 50');
    }

    const wallet = await this.getWalletByUserId(userId);
    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.transactionRepo.createMany([
          {
            walletId: wallet._id,
            riderId: userId,
            direction: TransactionDirection.CREDIT,
            type: TransactionType.TOPUP,
            amount,
            paymentMethod: PaymentMethod.WALLET,
            reference,
          },
        ], session);

        await this.walletRepo.incrementBalance(wallet._id, amount, session);
      });
    } finally {
      await session.endSession();
    }

    return this.getWalletByUserId(userId);
  }

  async withdraw(userId: string, amount: number, reference: string): Promise<Wallet> {
    if (amount < 50) {
      throw new BadRequestException('Minimum withdrawal amount is Rs 50');
    }

    const wallet = await this.getWalletByUserId(userId);

    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    const session = await this.connection.startSession();

    try {
      await session.withTransaction(async () => {
        await this.transactionRepo.createMany([
          {
            walletId: wallet._id,
            riderId: userId,
            direction: TransactionDirection.DEBIT,
            type: TransactionType.WITHDRAWAL,
            amount,
            paymentMethod: PaymentMethod.WALLET,
            reference,
          },
        ], session);

        await this.walletRepo.decrementBalance(wallet._id, amount, session);
      });
    } finally {
      await session.endSession();
    }

    return this.getWalletByUserId(userId);
  }

  // reconciliation check — sum transactions vs cached balance
  async reconcile(walletId: string): Promise<{ isBalanced: boolean; diff: number }> {
    const wallet = await this.walletRepo.findById(walletId);
    if (!wallet) throw new NotFoundException('Wallet not found');

    const { credits, debits } = await this.transactionRepo.sumByWalletId(walletId);
    const expectedBalance = credits - debits;
    const diff = wallet.balance - expectedBalance;

    return { isBalanced: diff === 0, diff };
  }
}