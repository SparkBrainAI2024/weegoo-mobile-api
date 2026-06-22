import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { WalletRepository } from '@libs/data-access/repositories/wallet.repository';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
import { UserDetailsRepository } from '@libs/data-access/repositories/user-detail.repository';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@libs/data-access/enums/transaction.enum';
import { PaymentMethodEnum, PaymentMediumEnum } from '@libs/data-access/enums/payment.enum';
import { EnvService } from '@libs/common/config/env.service';
import { Transaction } from '@libs/data-access';
import { EsewaService } from '../esewa/esewa.service';
import { KhaltiService } from '../khalti/khalti.service';

export interface TopupInput {
  userId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  paymentMedium: PaymentMediumEnum;
}

export interface WithdrawInput {
  userId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly walletRepo: WalletRepository,
    private readonly transactionRepo: TransactionRepository,
    private readonly userDetailsRepo: UserDetailsRepository,
    private readonly envService: EnvService,
    private readonly esewaService: EsewaService,
    private readonly khaltiService: KhaltiService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  // ── Internal: update UserDetails.walletAmount ────────────────
  private async syncUserDetailsWalletAmount(userId: string): Promise<void> {
    const wallet = await this.walletRepo.findByUserId(userId);
    if (wallet) {
      await this.userDetailsRepo.findOneAndUpdate(
        { userId: new Types.ObjectId(userId) },
        { $set: { walletAmount: wallet.balance } },
      );
    }
  }

  // ── Get wallet with balance ──────────────────────────────────
  async getWallet(userId: string) {
    return this.walletRepo.getOrCreate(userId);
  }

  // ── Get wallet balance only ──────────────────────────────────
  async getBalance(userId: string): Promise<number> {
    return this.walletRepo.getBalance(userId);
  }

  // ── Credit wallet (internal, used after successful payment) ──
  async creditWallet(
    userId: string,
    amount: number,
    session?: any,
  ): Promise<void> {
    await this.walletRepo.incrementBalance(userId, amount, session);
    await this.syncUserDetailsWalletAmount(userId);
  }

  // ── Debit wallet (internal, used after successful charge) ──
  async debitWallet(
    userId: string,
    amount: number,
    session?: any,
  ): Promise<void> {
    await this.walletRepo.decrementBalance(userId, amount, session);
    await this.syncUserDetailsWalletAmount(userId);
  }

  // ── Topup: Initiate (supports ESEWA and KHALTI) ──────────────
  async initiateTopup(input: TopupInput): Promise<{
    transactionId: string;
    amount: number;
    status: TransactionStatus;
    esewaPayload?: Record<string, any>;
    khaltiPayload?: Record<string, any>;
    gatewayUrl?: string;
    successUrl: string;
    failureUrl: string;
  }> {
    // Create a PENDING transaction with paymentMedium
    const [txn] = await this.transactionRepo.createMany([
      {
        riderId: input.userId,
        direction: TransactionDirection.CREDIT,
        type: TransactionType.TOPUP,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentMedium: input.paymentMedium,
        status: TransactionStatus.PENDING,
      },
    ]);

    // Build callback URLs from the server's base URL
    const baseUrl = this.envService.getString('API_BASE_URL', 'http://localhost:3000');
    const txnId = txn._id.toString();
    const successUrl = `${baseUrl}/payment/topup/success?transactionId=${txnId}`;
    const failureUrl = `${baseUrl}/payment/topup/failure?transactionId=${txnId}`;

    let esewaPayload: Record<string, any> | undefined;
    let khaltiPayload: Record<string, any> | undefined;
    let gatewayUrl: string | undefined;

    if (input.paymentMedium === PaymentMediumEnum.ESEWA) {
      const payload = this.esewaService.generatePaymentPayload({
        transactionId: txnId,
        amount: input.amount,
        successUrl,
        failureUrl,
      });
      esewaPayload = payload as unknown as Record<string, any>;
      gatewayUrl = this.esewaService.getPaymentUrl();
    } else if (input.paymentMedium === PaymentMediumEnum.KHALTI) {
      const payload = this.khaltiService.generatePaymentPayload({
        transactionId: txnId,
        amount: input.amount,
        returnUrl: successUrl,
        websiteUrl: baseUrl,
      });
      khaltiPayload = payload as unknown as Record<string, any>;
      gatewayUrl = this.khaltiService.getPaymentUrl({
        transactionId: txnId,
        amount: input.amount,
        returnUrl: successUrl,
      });
    }

    return {
      transactionId: txnId,
      amount: input.amount,
      status: TransactionStatus.PENDING,
      esewaPayload,
      khaltiPayload,
      gatewayUrl,
      successUrl,
      failureUrl,
    };
  }

  // ── Topup: Complete with server-side verification ────────────
  async completeTopup(transactionId: string, verifiedAmount: number): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const txn = await this.transactionRepo['model']
          .findById(transactionId)
          .session(session);

        if (!txn) {
          throw new NotFoundException('Transaction not found');
        }
        if (txn.status !== TransactionStatus.PENDING) {
          throw new BadRequestException('Transaction is not in PENDING state');
        }

        // Server-side verification based on payment medium
        let amountToCredit = verifiedAmount;
        if (txn.paymentMedium === PaymentMediumEnum.ESEWA && verifiedAmount === 0) {
          // eSewa callback does not pass amount; fetch real amount from transaction
          amountToCredit = txn.amount;
        } else if (txn.paymentMedium === PaymentMediumEnum.KHALTI && verifiedAmount === 0) {
          // Khalti callback may pass amount in paisa
          amountToCredit = txn.amount;
        }

        // Update transaction to COMPLETED
        txn.status = TransactionStatus.COMPLETED;
        txn.reference = `gateway-verify-${amountToCredit}`;
        await txn.save({ session });

        // Credit wallet (riderId is the userId for topup)
        await this.creditWallet(txn.riderId, amountToCredit, session);
      });
    } finally {
      await session.endSession();
    }
  }

  // ── Topup: Failure Callback ────────────────────────────
  async failTopup(transactionId: string, remarks?: string): Promise<void> {
    const txn = await this.transactionRepo['model'].findById(transactionId);

    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    if (txn.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not in PENDING state');
    }

    txn.status = TransactionStatus.FAILED;
    txn.remarks = remarks || 'Payment failed';
    await txn.save();
  }

  // ── Withdraw: Initiate ───────────────────────────────────────
  async initiateWithdraw(input: WithdrawInput): Promise<{
    transactionId: string;
    amount: number;
    status: TransactionStatus;
  }> {
    // Check sufficient balance first
    const balance = await this.walletRepo.getBalance(input.userId);
    if (balance < input.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    // Create PENDING withdrawal transaction
    const [txn] = await this.transactionRepo.createMany([
      {
        riderId: input.userId,
        direction: TransactionDirection.DEBIT,
        type: TransactionType.WITHDRAWAL,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        status: TransactionStatus.PENDING,
      },
    ]);

    return {
      transactionId: txn._id.toString(),
      amount: input.amount,
      status: TransactionStatus.PENDING,
    };
  }

  // ── Withdraw: Complete (admin approves & processes) ──────────
  async completeWithdraw(transactionId: string): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const txn = await this.transactionRepo['model']
          .findById(transactionId)
          .session(session);

        if (!txn) {
          throw new NotFoundException('Transaction not found');
        }
        if (txn.status !== TransactionStatus.PENDING) {
          throw new BadRequestException('Transaction is not in PENDING state');
        }
        if (txn.type !== TransactionType.WITHDRAWAL) {
          throw new BadRequestException('Transaction is not a withdrawal');
        }

        // Debit wallet (will throw if insufficient)
        await this.debitWallet(txn.riderId, txn.amount, session);

        // Mark transaction COMPLETED
        txn.status = TransactionStatus.COMPLETED;
        txn.reference = 'withdraw-approved';
        await txn.save({ session });
      });
    } finally {
      await session.endSession();
    }
  }

  // ── Withdraw: Fail (admin rejects) ───────────────────────────
  async failWithdraw(transactionId: string, remarks?: string): Promise<void> {
    const txn = await this.transactionRepo['model'].findById(transactionId);

    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    if (txn.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not in PENDING state');
    }

    txn.status = TransactionStatus.FAILED;
    txn.remarks = remarks || 'Withdrawal rejected by admin';
    await txn.save();
  }

  // ── After ride completion: process wallet payments ───────────
  async processRideWalletPayment(input: {
    riderId: string;
    driverId: string;
    adminId: string;
    totalFare: number;
    commission: number;
    tripId: string;
  }): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const driverAmount = input.totalFare - input.commission;

        // Debit rider wallet
        await this.debitWallet(input.riderId, input.totalFare, session);

        // Credit driver wallet
        await this.creditWallet(input.driverId, driverAmount, session);

        // Credit admin wallet (commission)
        await this.creditWallet(input.adminId, input.commission, session);
      });
    } finally {
      await session.endSession();
    }
  }
}