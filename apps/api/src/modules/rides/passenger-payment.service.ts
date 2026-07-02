import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { Transaction, TransactionDocument } from '@libs/data-access/entities/transaction.entity';
import { User, UserDocument } from '@libs/data-access/entities/user.entity';
import { PromoCode, PromoCodeDocument } from '@libs/data-access/entities/promo-code.entity';
import { RideChannelService } from '@libs/services/ably';
import { WalletService } from '@libs/services/payment/src/wallet/wallet.service';
import { RidesRepository } from '@libs/data-access/repositories/rides.repository';
import { TransactionRepository } from '@libs/data-access/repositories/transaction.repository';
import { PromoCodeRepository } from '@libs/data-access/repositories/promo-code.repository';
import { UserDetailsRepository } from '@libs/data-access/repositories/user-detail.repository';
import {
  TransactionDirection,
  TransactionStatus,
  TransactionType,
} from '@libs/data-access/enums/transaction.enum';
import { PaymentMethodEnum } from '@libs/data-access/enums/payment.enum';
import { EnvService } from '@libs/common/config/env.service';
import { PaymentDetails } from '@libs/data-access/common/payment-details';
import axios from 'axios';

export interface PassengerPaymentResult {
  success: boolean;
  message: string;
  rideId: string;
  rideUUId: string;
  paymentMethod: PaymentMethodEnum;
  fareBreakdown: {
    baseFare: number;
    distanceCharge: number;
    discount: number;
    totalFare: number;
  };
  transactions: {
    transactionId: string;
    userId: string;
    type: string;
    amount: number;
  }[];
  paid: boolean;
}

@Injectable()
export class PassengerPaymentService {
  private readonly logger = new Logger(PassengerPaymentService.name);
  private matchmakingUrl: string;
  private adminId: string;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(PromoCode.name) private readonly promoCodeModel: Model<PromoCodeDocument>,
    private readonly ridesRepository: RidesRepository,
    private readonly transactionRepository: TransactionRepository,
    private readonly promoCodeRepository: PromoCodeRepository,
    private readonly userDetailsRepository: UserDetailsRepository,
    private readonly walletService: WalletService,
    private readonly rideChannelService: RideChannelService,
    private readonly envService: EnvService,
  ) {
    this.matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    this.adminId = this.envService.getString('ADMIN_USER_ID', 'admin');
  }

  /**
   * Process passenger payment for a completed ride.
   * Handles both CASH and WALLET payment methods.
   * Creates transactions for passenger, driver, and admin.
   * Applies promo code discount if provided.
   */
  async processPayment(
    rideId: string,
    passengerId: string,
    paymentMethod: PaymentMethodEnum,
    promoCodeId?: string,
  ): Promise<PassengerPaymentResult> {
    this.logger.log(`Processing payment for ride ${rideId} by passenger ${passengerId}`);

    // Validate ride exists and is completed
    const ride = await this.ridesRepository.findById(new Types.ObjectId(rideId));
    if (!ride) {
      throw new NotFoundException('Ride not found');
    }

    if (ride.rideStatus !== 'COMPLETED') {
      throw new BadRequestException('Ride must be completed before payment');
    }

    // Check if already paid
    if (ride.paymentDetails?.['paid']) {
      throw new BadRequestException('Ride has already been paid');
    }

    // Validate driver exists
    if (!ride.driverId) {
      throw new BadRequestException('Ride has no assigned driver');
    }
    const driverId = ride.driverId.toString();

    // Calculate fare breakdown
    const fareBreakdown = await this.calculateFareBreakdown(
      ride,
      promoCodeId,
      passengerId,
    );

    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const transactions: {
          transactionId: string;
          userId: string;
          type: string;
          amount: number;
        }[] = [];

        // ── Process based on payment method ──────────────────────
        if (paymentMethod === PaymentMethodEnum.WALLET) {
          // Debit passenger wallet for total fare
          await this.walletService.debitWallet(
            passengerId,
            fareBreakdown.totalFare,
            session,
          );

          // Create passenger debit transaction
          const passengerTxn = await this.createTransaction(
            passengerId,
            TransactionDirection.DEBIT,
            TransactionType.RIDE_PAYMENT,
            fareBreakdown.totalFare,
            paymentMethod,
            ride._id.toString(),
            driverId,
            session,
          );
          transactions.push({
            transactionId: passengerTxn._id.toString(),
            userId: passengerId,
            type: 'DEBIT',
            amount: fareBreakdown.totalFare,
          });

          // Credit driver (total - commission)
          const driverAmount = fareBreakdown.totalFare - fareBreakdown.discount;
          await this.walletService.creditWallet(driverId, driverAmount, session);

          const driverTxn = await this.createTransaction(
            driverId,
            TransactionDirection.CREDIT,
            TransactionType.COMMISSION,
            driverAmount,
            paymentMethod,
            ride._id.toString(),
            passengerId,
            session,
          );
          transactions.push({
            transactionId: driverTxn._id.toString(),
            userId: driverId,
            type: 'CREDIT',
            amount: driverAmount,
          });

          // Credit admin (commission = discount)
          if (fareBreakdown.discount > 0) {
            await this.walletService.creditWallet(
              this.adminId,
              fareBreakdown.discount,
              session,
            );
            const adminTxn = await this.createTransaction(
              this.adminId,
              TransactionDirection.CREDIT,
              TransactionType.COMMISSION,
              fareBreakdown.discount,
              paymentMethod,
              ride._id.toString(),
              passengerId,
              session,
            );
            transactions.push({
              transactionId: adminTxn._id.toString(),
              userId: this.adminId,
              type: 'CREDIT',
              amount: fareBreakdown.discount,
            });
          }
        } else if (paymentMethod === PaymentMethodEnum.CASH) {
          // For cash payments, we still create transaction records
          // but don't modify wallet balances

          const passengerTxn = await this.createTransaction(
            passengerId,
            TransactionDirection.DEBIT,
            TransactionType.RIDE_PAYMENT,
            fareBreakdown.totalFare,
            paymentMethod,
            ride._id.toString(),
            driverId,
            session,
          );
          transactions.push({
            transactionId: passengerTxn._id.toString(),
            userId: passengerId,
            type: 'DEBIT',
            amount: fareBreakdown.totalFare,
          });

          const driverAmount = fareBreakdown.totalFare - fareBreakdown.discount;
          const driverTxn = await this.createTransaction(
            driverId,
            TransactionDirection.CREDIT,
            TransactionType.COMMISSION,
            driverAmount,
            paymentMethod,
            ride._id.toString(),
            passengerId,
            session,
          );
          transactions.push({
            transactionId: driverTxn._id.toString(),
            userId: driverId,
            type: 'CREDIT',
            amount: driverAmount,
          });

          if (fareBreakdown.discount > 0) {
            const adminTxn = await this.createTransaction(
              this.adminId,
              TransactionDirection.CREDIT,
              TransactionType.COMMISSION,
              fareBreakdown.discount,
              paymentMethod,
              ride._id.toString(),
              passengerId,
              session,
            );
            transactions.push({
              transactionId: adminTxn._id.toString(),
              userId: this.adminId,
              type: 'CREDIT',
              amount: fareBreakdown.discount,
            });
          }
        } else {
          throw new BadRequestException('Unsupported payment method');
        }

        // ── Update ride with payment details ──────────────────────
        const paymentDetails: PaymentDetails = {
          baseAmount: fareBreakdown.baseFare,
          distanceAmount: fareBreakdown.distanceCharge,
          totalAmount: fareBreakdown.totalFare,
          noOfPassengers: ride.noOfPassengers || 1,
          paymentMethod,
          discountAmount: fareBreakdown.discount,
          promoCodeId: promoCodeId ? new Types.ObjectId(promoCodeId) : null,
          driverCommission: fareBreakdown.discount > 0 && fareBreakdown.totalFare > 0
            ? fareBreakdown.discount / fareBreakdown.totalFare
            : 0.2,
        };

        await this.ridesModel.updateOne(
          { _id: ride._id },
          {
            $set: {
              paymentDetails,
              'paymentDetails.paid': true,
            },
          },
          { session },
        );

        // ── Mark promo code as used if applicable ─────────────────
        if (promoCodeId) {
          await this.promoCodeRepository.updateById(
            new Types.ObjectId(promoCodeId),
            { $inc: { promoCodeUsedCount: 1 } },
            undefined,
            { session },
          );
        }

        // Store transactions for response
        (this as any)._transactions = transactions;
      });
    } finally {
      await session.endSession();
    }

    // ── Publish payment completed event to Ably ───────────────────
    await this.rideChannelService.publishRideEvent(ride.rideUUId, 'payment-completed', {
      rideId,
      rideUUId: ride.rideUUId,
      paymentMethod,
      totalFare: fareBreakdown.totalFare,
      discount: fareBreakdown.discount,
      paid: true,
      fareBreakdown,
    });

    // ── Call matchmaking service to update paid status ────────────
    await this.notifyMatchmakingService(ride.rideUUId, fareBreakdown, paymentMethod, true);

    this.logger.log(`Payment processed successfully for ride ${rideId}`);

    return {
      success: true,
      message: 'Payment processed successfully',
      rideId,
      rideUUId: ride.rideUUId,
      paymentMethod,
      fareBreakdown,
      transactions: (this as any)._transactions || [],
      paid: true,
    };
  }

  /**
   * Calculate fare breakdown with optional promo code discount.
   * Uses base fare and distance charge from the ride's already-computed fare object.
   * Only the promo code discount is calculated here.
   */
  private async calculateFareBreakdown(
    ride: RidesDocument,
    promoCodeId?: string,
    passengerId?: string,
  ): Promise<{ baseFare: number; distanceCharge: number; discount: number; totalFare: number }> {
    // Use base fare and distance charge from ride.fare (already calculated during ride completion)
    const baseFare = Number(ride.fare?.baseAmount || 0);
    const distanceCharge = Number(ride.fare?.distanceAmount || 0);

    let subtotal = baseFare + distanceCharge;
    let discount = 0;

    // Apply promo code discount if provided
    if (promoCodeId) {
      const promoCode = await this.promoCodeRepository.findById(
        new Types.ObjectId(promoCodeId),
      );

      if (!promoCode) {
        throw new NotFoundException('Promo code not found');
      }

      // Validate promo code
      if (promoCode.status !== 'ACTIVE') {
        throw new BadRequestException('Promo code is not active');
      }

      if (new Date() < promoCode.startDateTime || new Date() > promoCode.expiryDateTime) {
        throw new BadRequestException('Promo code is not valid at this time');
      }

      if (promoCode.minimumFare && subtotal < promoCode.minimumFare) {
        throw new BadRequestException(`Minimum fare of NPR ${promoCode.minimumFare} required`);
      }

      // Check if user has already used this promo code
      if (promoCode.perUserLimit > 0) {
        const usedCount = await this.promoCodeRepository.count({
          promoCodeId: promoCode._id,
          userId: new Types.ObjectId(passengerId),
        });
        if (usedCount >= promoCode.perUserLimit) {
          throw new BadRequestException('Promo code usage limit reached');
        }
      }

      // Calculate discount
      if (promoCode.discountType === 'PERCENTAGE' && promoCode.percentageAmount) {
        discount = (subtotal * promoCode.percentageAmount) / 100;
        // Cap at max discount
        if (promoCode.maxDiscount && discount > promoCode.maxDiscount) {
          discount = promoCode.maxDiscount;
        }
      } else if (promoCode.discountType === 'FLAT' && promoCode.flatAmount) {
        discount = promoCode.flatAmount;
        // Don't let discount exceed subtotal
        if (discount > subtotal) {
          discount = subtotal;
        }
      }
    }

    const totalFare = subtotal - discount;

    return {
      baseFare,
      distanceCharge,
      discount,
      totalFare,
    };
  }

  /**
   * Create a transaction record.
   */
  private async createTransaction(
    userId: string,
    direction: TransactionDirection,
    type: TransactionType,
    amount: number,
    paymentMethod: PaymentMethodEnum,
    tripId: string,
    _relatedUserId: string,
    session?: any,
  ): Promise<TransactionDocument> {
    const transactionUuid = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const isRider = direction === TransactionDirection.DEBIT;

    const [transaction] = await this.transactionRepository.createMany(
      [
        {
          ...(isRider ? { riderId: userId } : { driverId: userId }),
          tripId,
          direction,
          type,
          amount,
          paymentMethod,
          status: TransactionStatus.COMPLETED,
          transactionUuid,
          reference: `${type}-${tripId}`,
        },
      ],
      session,
    );

    return transaction as unknown as TransactionDocument;
  }

  /**
   * Notify matchmaking service about payment completion.
   */
  private async notifyMatchmakingService(
    rideUUId: string,
    fareBreakdown: { baseFare: number; distanceCharge: number; discount: number; totalFare: number },
    paymentMethod: PaymentMethodEnum,
    paid: boolean,
  ): Promise<void> {
    try {
      await axios.post(
        `${this.matchmakingUrl}/graphql`,
        {
          query: `
            mutation UpdateRidePaymentStatus($rideUUID: String!, $fareBreakdown: FareBreakdownInput!, $paymentMethod: String!, $paid: Boolean!) {
              updateRidePaymentStatus(rideUUID: $rideUUID, fareBreakdown: $fareBreakdown, paymentMethod: $paymentMethod, paid: $paid) {
                success
                message
              }
            }
          `,
          variables: {
            rideUUID: rideUUId,
            fareBreakdown: {
              baseFare: fareBreakdown.baseFare,
              distanceCharge: fareBreakdown.distanceCharge,
              durationCharge: 0,
              discount: fareBreakdown.discount,
              total: fareBreakdown.totalFare,
            },
            paymentMethod,
            paid,
          },
        },
      );
      this.logger.debug(`Notified matchmaking service about payment for ride ${rideUUId}`);
    } catch (error: any) {
      this.logger.warn(`Failed to notify matchmaking service: ${error?.message}`);
      // Don't fail the payment if matchmaking notification fails
    }
  }
}