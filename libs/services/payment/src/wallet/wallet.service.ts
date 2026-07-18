import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import { WalletRepository } from '@libs/data-access/repositories/wallet.repository';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
import { UserDetailsRepository } from '@libs/data-access/repositories/user-detail.repository';
import { UserRepository } from '@libs/data-access/repositories/user.repository';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@libs/data-access/enums/transaction.enum';
import { PaymentMethodEnum, PaymentMediumEnum } from '@libs/data-access/enums/payment.enum';
import { EnvService } from '@libs/common/config/env.service';
import { NotificationType, Transaction, User } from '@libs/data-access';
import { EsewaService, EsewaSdkPayload } from '../esewa/esewa.service';
import { KhaltiService, KhaltiSdkPayload } from '../khalti/khalti.service';
import { NotificationService } from '@libs/services/notification';

export interface TopupInput {
  userId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  paymentMedium: PaymentMediumEnum;
  loginAs?: string;
}

export interface WithdrawInput {
  userId: string;
  amount: number;
  paymentMethod: PaymentMethodEnum;
  paymentMedium: PaymentMediumEnum;
  /** The user's eSewa mobile/email or Khalti mobile for receiving the payout */
  accountIdentifier: string;
  loginAs?: string;
}

export interface TopupInitiateResult {
  transactionId: string;
  amount: number;
  status: TransactionStatus;
  esewaPayload?: EsewaSdkPayload;
  khaltiPayload?: KhaltiSdkPayload;
  gatewayUrl?: string;
  successUrl: string;
  failureUrl: string;
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
    private readonly notificationService: NotificationService,
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
  async initiateTopup(input: TopupInput): Promise<TopupInitiateResult> {
    // Create a PENDING transaction with paymentMedium
    const isDriver = input.loginAs === 'RIDER';
    const transactionUuid = `TOPUP-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const [txn] = await this.transactionRepo.createMany([
      {
        ...(isDriver ? { driverId: input.userId } : { riderId: input.userId }),
        direction: TransactionDirection.CREDIT,
        type: TransactionType.TOPUP,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentMedium: input.paymentMedium,
        transactionUuid,
        status: TransactionStatus.PENDING,
      },
    ]);

    // Build callback URLs from the server's base URL
    // NOTE: We use transactionUuid (random generated ID) as the external identifier
    // for eSewa/Khalti callbacks, NOT the MongoDB _id. The transactionUuid is saved
    // on the transaction and used to look it up during callbacks.
    const baseUrl = this.envService.getString('API_BASE_URL', 'http://localhost:3000');
    const txnId = txn._id.toString();
    const callbackSuccessUrl = `${baseUrl}/payment/esewa/success?transactionUuid=${transactionUuid}`;
    const callbackFailureUrl = `${baseUrl}/payment/esewa/failure?transactionUuid=${transactionUuid}`;
    const frontendSuccessUrl = `${baseUrl}/payment/esewa/success`;
    const frontendFailureUrl = `${baseUrl}/payment/esewa/failure`;

    let esewaPayload: EsewaSdkPayload | undefined;
    let khaltiPayload: KhaltiSdkPayload | undefined;
    let gatewayUrl: string | undefined;

    if (input.paymentMedium === PaymentMediumEnum.ESEWA) {
      const payload = this.esewaService.generatePaymentPayload({
        transactionId: transactionUuid, // Use random transactionUuid, not MongoDB _id
        amount: input.amount,
        successUrl: callbackSuccessUrl,
        failureUrl: callbackFailureUrl,
      });
      esewaPayload = payload;
      gatewayUrl = payload.paymentUrl;
    } else if (input.paymentMedium === PaymentMediumEnum.KHALTI) {
      // For Khalti, initiate the payment server-side to get a pidx
      const khaltiReturnUrl = `${baseUrl}/payment/khalti/success?transactionUuid=${transactionUuid}`;
      khaltiPayload = await this.khaltiService.initiatePayment({
        transactionId: txnId,
        amount: input.amount,
        returnUrl: khaltiReturnUrl,
        websiteUrl: baseUrl,
      });
      gatewayUrl = khaltiPayload.paymentUrl;

      // Save the pidx to the transaction if we got one
      if (khaltiPayload.pidx) {
        await this.transactionRepo['model'].findByIdAndUpdate(txnId, {
          $set: { gatewayRef: khaltiPayload.pidx },
        });
      }
    }

    return {
      transactionId: txnId,
      amount: input.amount,
      status: TransactionStatus.PENDING,
      esewaPayload,
      khaltiPayload,
      gatewayUrl,
      successUrl: frontendSuccessUrl,
      failureUrl: frontendFailureUrl,
    };
  }

  // ── Topup: Complete with server-side verification (no MongoDB transaction) ──
  //
  // eSewa Verification Flow:
  //   1. eSewa redirects user to our success URL with refId in query params
  //   2. We call verifyTransaction(refId, amount) via POST /epay/transrec
  //   3. eSewa responds with <response_code>Success</response_code>
  //   4. If verification succeeds, we credit the wallet
  //   5. If no callback received within 5 minutes, use getTransactionStatus() as fallback
  //

  /**
   * Look up a transaction by its random transactionUuid (e.g. "TOPUP-xxx").
   * This is used by payment gateway callbacks which receive the transactionUuid
   * as a query parameter instead of the MongoDB _id.
   */
  private async findTransactionByUuid(transactionUuid: string) {
    const txn = await this.transactionRepo['model'].findOne({ transactionUuid });
    if (!txn) {
      throw new NotFoundException(`Transaction not found for uuid: ${transactionUuid}`);
    }
    return txn;
  }

  /**
   * Complete a topup by looking up the transaction via its random transactionUuid.
   * This is the method called by payment gateway callbacks (eSewa/Khalti redirects).
   */
  async completeTopupByUuid(
    transactionUuid: string,
    verifiedAmount: number,
    options?: { refId?: string },
  ): Promise<void> {
    const txn = await this.findTransactionByUuid(transactionUuid);
    return this.completeTopup(txn._id.toString(), verifiedAmount, options);
  }

  /**
   * Fail a topup by looking up the transaction via its random transactionUuid.
   * This is the method called by payment gateway callbacks (eSewa/Khalti redirects).
   */
  async failTopupByUuid(transactionUuid: string, remarks?: string): Promise<void> {
    const txn = await this.findTransactionByUuid(transactionUuid);
    return this.failTopup(txn._id.toString(), remarks);
  }

  async completeTopup(
    transactionId: string,
    verifiedAmount: number,
    options?: { refId?: string },
  ): Promise<void> {
    const txn = await this.transactionRepo['model'].findById(transactionId);

    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    if (txn.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not in PENDING state');
    }

    let amountToCredit = verifiedAmount;
    if (txn.paymentMedium === PaymentMediumEnum.ESEWA && verifiedAmount === 0) {
      amountToCredit = txn.amount;
    } else if (txn.paymentMedium === PaymentMediumEnum.KHALTI && verifiedAmount === 0) {
      amountToCredit = txn.amount;
    }

    // ── eSewa Primary Verification: via refId (POST /epay/transrec) ──
    // eSewa redirects to our success URL with refId (reference ID).
    // We verify by posting to eSewa's transrec endpoint with scd, rid, amt.
    if (txn.paymentMedium === PaymentMediumEnum.ESEWA && options?.refId) {
      const verified = await this.esewaService.verifyTransaction(
        options.refId,
        amountToCredit,
      );

      if (!verified) {
        throw new BadRequestException('eSewa transaction verification failed: invalid refId');
      }
    } else if (txn.paymentMedium === PaymentMediumEnum.ESEWA && !options?.refId) {
      // ── eSewa Fallback: Status check API (when no callback received) ──
      // Per eSewa flow step 6: if no response within 5 minutes, use status API
      // This should only be called for delayed verification, not during callback
      if (txn.transactionUuid) {
        const merchantCode = this.envService.getString('ESEWA_MERCHANT_CODE', 'EPAYTEST');
        const esewaStatus = await this.esewaService.getTransactionStatus(
          merchantCode,
          amountToCredit,
          txn.transactionUuid,
        );

        if (esewaStatus !== 'COMPLETE') {
          throw new BadRequestException(`eSewa status verification failed: ${esewaStatus}`);
        }
      }
    }

    // Update transaction to COMPLETED
    txn.status = TransactionStatus.COMPLETED;
    txn.reference = options?.refId || `gateway-verify-${amountToCredit}`;
    await txn.save();

    // Credit wallet (no session needed - standalone MongoDB)
    const userId = txn.riderId || txn.driverId;
    if (!userId) {
      throw new BadRequestException('Transaction has no associated user');
    }
    await this.creditWallet(userId, amountToCredit);

    // Send success FCM notification
    await this.notificationService.createNotification(
      {
        title: 'Wallet Top-up Successful',
        description: `NPR ${amountToCredit} has been added to your wallet.`,
        notificationType: NotificationType.PAYMENT_RECEIPT as any,
        rideId: undefined,
      },
      { _id: new Types.ObjectId(userId), loginAs: txn.riderId ? 'USER' : 'RIDER' } as any,
    );
  }

  /**
   * Complete a Khalti topup by looking up the pidx on Khalti's server.
   * This is the preferred verification method for Khalti EPayment.
   *
   * Steps:
   * 1. Lookup the pidx on Khalti's server to verify the payment
   * 2. Find the transaction by transactionId
   * 3. Credit the wallet
   */
  async completeTopupWithKhalti(
    pidx: string,
    transactionId?: string,
  ): Promise<{ success: boolean; message: string }> {
    // First, lookup the pidx on Khalti's server
    const lookupResult = await this.khaltiService.lookupTransaction(pidx);

    if (!lookupResult.success) {
      // If lookup failed, try to mark the transaction as failed
      if (transactionId) {
        try {
          await this.failTopup(transactionId, `Khalti lookup failed: ${lookupResult.status}`);
        } catch (e) {
          // ignore
        }
      }
      return { success: false, message: `Khalti payment verification failed: ${lookupResult.status}` };
    }

    // Find the transaction. If transactionId was provided, use it.
    // Otherwise, find the transaction by the gatewayRef (pidx).
    let txnId = transactionId;
    if (!txnId) {
      const txn = await this.transactionRepo['model'].findOne({
        gatewayRef: pidx,
        status: TransactionStatus.PENDING,
      });
      if (txn) {
        txnId = txn._id.toString();
      }
    }

    if (!txnId) {
      return { success: false, message: 'Transaction not found for the given pidx' };
    }

    // Complete the topup with the verified amount
    try {
      await this.completeTopup(txnId, lookupResult.amount || 0);
      return { success: true, message: 'Topup completed successfully' };
    } catch (error: any) {
      return { success: false, message: error.message };
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

    const userId = txn.riderId || txn.driverId;
    if (userId) {
      // Build a user-friendly error message - strip technical MongoDB details
      const userFriendlyMessage = this.sanitizeErrorMessage(remarks || 'Payment failed');

      await this.notificationService.createNotification(
        {
          title: 'Wallet Top-up Failed',
          description: `Your NPR ${txn.amount} top-up could not be completed. ${userFriendlyMessage}`,
          notificationType: NotificationType.PAYMENT_FAILURE as any,
          rideId: undefined,
        },
        { _id: new Types.ObjectId(userId), loginAs: txn.riderId ? 'USER' : 'RIDER' } as any,
      );
    }
  }

  /**
   * Sanitize error messages to remove technical details (MongoDB errors, stack traces, etc.)
   * and provide user-friendly messages.
   */
  private sanitizeErrorMessage(message: string): string {
    if (!message) return 'Please try again.';

    // Check for common MongoDB/technical errors and provide user-friendly alternatives
    const technicalErrors: { pattern: RegExp; replacement: string }[] = [
      { pattern: /Transaction numbers are only allowed on a replica set member or mongos/i, replacement: 'A temporary system error occurred.' },
      { pattern: /WriteConflict/i, replacement: 'A temporary system error occurred. Please try again.' },
      { pattern: /MongoServerError/i, replacement: 'A temporary system error occurred.' },
      { pattern: /Cannot create session/i, replacement: 'A temporary system error occurred.' },
      { pattern: /Session.*error/i, replacement: 'A temporary system error occurred.' },
    ];

    for (const { pattern, replacement } of technicalErrors) {
      if (pattern.test(message)) {
        return replacement;
      }
    }

    // If message is too long (contains stack trace), truncate
    if (message.length > 200) {
      return message.substring(0, 197) + '...';
    }

    return message;
  }

  // ── Withdraw: Initiate ───────────────────────────────────────
  async initiateWithdraw(input: WithdrawInput): Promise<{
    transactionId: string;
    amount: number;
    status: TransactionStatus;
    /** The payment medium (ESEWA or KHALTI) for the withdrawal */
    paymentMedium: PaymentMediumEnum;
    /** The account identifier where funds were sent */
    accountIdentifier: string;
  }> {
    // Check sufficient balance first
    const balance = await this.walletRepo.getBalance(input.userId);
    if (balance < input.amount) {
      throw new BadRequestException('Insufficient wallet balance');
    }

    if (!input.paymentMedium) {
      throw new BadRequestException('Payment medium (ESEWA or KHALTI) is required for withdrawal');
    }

    if (!input.accountIdentifier) {
      throw new BadRequestException('Account identifier (eSewa mobile/email or Khalti mobile) is required for withdrawal');
    }

    const isDriver = input.loginAs === 'RIDER';
    const transactionUuid = `WITHDRAW-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Create PENDING withdrawal transaction
    const [txn] = await this.transactionRepo.createMany([
      {
        ...(isDriver ? { driverId: input.userId } : { riderId: input.userId }),
        direction: TransactionDirection.DEBIT,
        type: TransactionType.WITHDRAWAL,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentMedium: input.paymentMedium,
        transactionUuid,
        reference: input.accountIdentifier,
        status: TransactionStatus.PENDING,
      },
    ]);

    const txnId = txn._id.toString();

    // ── Process actual payout to eSewa/Khalti ──
    // We attempt the payout immediately. If it fails, we mark the transaction as failed.
    let payoutResult: { success: boolean; message: string; referenceId?: string };

    if (input.paymentMedium === PaymentMediumEnum.ESEWA) {
      payoutResult = await this.esewaService.initiatePayout({
        receiverAccount: input.accountIdentifier,
        amount: input.amount,
        transactionId: transactionUuid,
        remarks: 'Wallet withdrawal',
      });
    } else if (input.paymentMedium === PaymentMediumEnum.KHALTI) {
      payoutResult = await this.khaltiService.initiatePayout({
        receiverAccount: input.accountIdentifier,
        amount: input.amount,
        transactionId: transactionUuid,
        remarks: 'Wallet withdrawal',
      });
    } else {
      throw new BadRequestException(`Unsupported payment medium: ${input.paymentMedium}`);
    }

    if (payoutResult.success) {
      // Payout succeeded - debit wallet and mark as completed
      await this.debitWallet(input.userId, input.amount);
      await this.transactionRepo['model'].findByIdAndUpdate(txnId, {
        $set: {
          status: TransactionStatus.COMPLETED,
          reference: payoutResult.referenceId || input.accountIdentifier,
          remarks: `Payout completed via ${input.paymentMedium} to ${input.accountIdentifier}`,
        },
      });

      // Send success notification
      await this.notificationService.createNotification(
        {
          title: 'Withdrawal Successful',
          description: `NPR ${input.amount} has been sent to your ${input.paymentMedium === PaymentMediumEnum.ESEWA ? 'eSewa' : 'Khalti'} account (${input.accountIdentifier}).`,
          notificationType: NotificationType.PAYMENT_RECEIPT as any,
          rideId: undefined,
        },
        { _id: new Types.ObjectId(input.userId), loginAs: isDriver ? 'RIDER' : 'USER' } as any,
      );
    } else {
      // Payout failed - mark transaction as failed
      await this.transactionRepo['model'].findByIdAndUpdate(txnId, {
        $set: {
          status: TransactionStatus.FAILED,
          remarks: payoutResult.message || `${input.paymentMedium} payout failed`,
        },
      });

      // Send failure notification
      await this.notificationService.createNotification(
        {
          title: 'Withdrawal Failed',
          description: `Your NPR ${input.amount} withdrawal to ${input.paymentMedium === PaymentMediumEnum.ESEWA ? 'eSewa' : 'Khalti'} (${input.accountIdentifier}) could not be completed. ${payoutResult.message || 'Please try again or contact support.'}`,
          notificationType: NotificationType.PAYMENT_FAILURE as any,
          rideId: undefined,
        },
        { _id: new Types.ObjectId(input.userId), loginAs: isDriver ? 'RIDER' : 'USER' } as any,
      );

      throw new BadRequestException(payoutResult.message || `${input.paymentMedium} payout failed. Please try again.`);
    }

    return {
      transactionId: txnId,
      amount: input.amount,
      status: TransactionStatus.COMPLETED,
      paymentMedium: input.paymentMedium,
      accountIdentifier: input.accountIdentifier,
    };
  }

  // ── Withdraw: Complete (admin approves & processes) ──────────
  async completeWithdraw(transactionId: string): Promise<void> {
    const txn = await this.transactionRepo['model'].findById(transactionId);

    if (!txn) {
      throw new NotFoundException('Transaction not found');
    }
    if (txn.status !== TransactionStatus.PENDING) {
      throw new BadRequestException('Transaction is not in PENDING state');
    }
    if (txn.type !== TransactionType.WITHDRAWAL) {
      throw new BadRequestException('Transaction is not a withdrawal');
    }

    // Debit wallet
    await this.debitWallet(txn.riderId || txn.driverId, txn.amount);

    // Mark transaction COMPLETED
    txn.status = TransactionStatus.COMPLETED;
    txn.reference = 'withdraw-approved';
    await txn.save();
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

  // ── After ride completion: process wallet payments (no MongoDB transaction) ──
  async processRideWalletPayment(input: {
    riderId: string;
    driverId: string;
    adminId: string;
    totalFare: number;
    commission: number;
    tripId: string;
  }): Promise<void> {
    const driverAmount = input.totalFare - input.commission;

    // Debit rider wallet
    await this.debitWallet(input.riderId, input.totalFare);

    // Credit driver wallet
    await this.creditWallet(input.driverId, driverAmount);

    // Credit admin wallet (commission)
    await this.creditWallet(input.adminId, input.commission);
  }
}