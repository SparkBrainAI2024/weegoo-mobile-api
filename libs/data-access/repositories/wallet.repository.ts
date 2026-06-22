import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import { Wallet, WalletDocument } from '../entities/wallet.entity';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectModel(Wallet.name)
    private readonly model: Model<WalletDocument>,
  ) {}

  /**
   * Get or create a wallet for a user. Creates one with 0 balance if it doesn't exist.
   */
  async getOrCreate(userId: string): Promise<WalletDocument> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    let wallet = await this.model.findOne({ userId: id });
    if (!wallet) {
      wallet = await this.model.create({ userId: id, balance: 0 });
    }
    return wallet;
  }

  /**
   * Increment balance (credit). Throws if insufficient funds (for debit use decrementBalance).
   */
  async incrementBalance(
    userId: string,
    amount: number,
    session?: ClientSession,
  ): Promise<WalletDocument> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const wallet = await this.model.findOneAndUpdate(
      { userId: id },
      { $inc: { balance: amount } },
      { new: true, session },
    );
    if (!wallet) {
      return this.getOrCreate(userId);
    }
    return wallet;
  }

  /**
   * Decrement balance (debit). Throws BadRequest if insufficient funds.
   */
  async decrementBalance(
    userId: string,
    amount: number,
    session?: ClientSession,
  ): Promise<WalletDocument> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const wallet = await this.model.findOne({ userId: id }).session(session || null);
    if (!wallet) {
      throw new BadRequestException('Wallet not found');
    }
    if (wallet.balance < amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    const updated = await this.model.findOneAndUpdate(
      { userId: id, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true, session },
    );
    if (!updated) {
      throw new BadRequestException('Insufficient wallet balance');
    }
    return updated;
  }

  /**
   * Get wallet balance for a user.
   */
  async getBalance(userId: string): Promise<number> {
    const wallet = await this.getOrCreate(userId);
    return wallet.balance;
  }

  /**
   * Find wallet by userId.
   */
  async findByUserId(userId: string): Promise<WalletDocument | null> {
    const id = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    return this.model.findOne({ userId: id });
  }
}