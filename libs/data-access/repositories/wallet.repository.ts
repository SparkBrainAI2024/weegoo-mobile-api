import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, ClientSession } from 'mongoose';
import { Wallet, WalletDocument } from './wallet.schema';
import { WalletUserType } from '../../common/enums';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectModel(Wallet.name)
    private readonly model: Model<WalletDocument>,
  ) {}

  async findByUserId(userId: string): Promise<Wallet | null> {
    return this.model.findOne({ userId });
  }

  async findById(walletId: string): Promise<Wallet | null> {
    return this.model.findById(walletId);
  }

  async createWallet(userId: string, userType: WalletUserType): Promise<Wallet> {
    return this.model.create({ userId, userType, balance: 0 });
  }

  // atomic increment — no race condition
  async incrementBalance(
    walletId: string,
    amount: number,
    session?: ClientSession,
  ): Promise<void> {
    await this.model.findByIdAndUpdate(
      walletId,
      { $inc: { balance: amount } },
      { session },
    );
  }

  // atomic decrement — check min: 0 constraint catches negative
  async decrementBalance(
    walletId: string,
    amount: number,
    session?: ClientSession,
  ): Promise<void> {
    const result = await this.model.findOneAndUpdate(
      { _id: walletId, balance: { $gte: amount } }, // guard: sufficient balance
      { $inc: { balance: -amount } },
      { session },
    );

    if (!result) {
      throw new Error('Insufficient wallet balance');
    }
  }
}