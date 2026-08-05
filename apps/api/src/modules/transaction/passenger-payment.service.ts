import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { PromoCodeUsed } from '@libs/data-access/entities/promo-code-used.entity';
import { TransactionDocument } from '@libs/data-access/entities/transaction.entity';
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
import { PaymentMethodEnum, PaymentStatusEnum } from '@libs/data-access/enums/payment.enum';
import { EnvService } from '@libs/common/config/env.service';
import { PaymentDetails } from '@libs/data-access/common/payment-details';
import axios from 'axios';
import { AdminUser, AdminUserDocument } from '@libs/data-access/entities/admin-user.entity';
import { ErrorException } from '@libs/common';
import { DiscountTypeEnum } from '@libs/data-access';

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
        subTotal: number;
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
        @InjectModel(PromoCodeUsed.name)
        private readonly promoCodeUsedModel: Model<PromoCodeUsed>,

        private readonly ridesRepository: RidesRepository,
        private readonly transactionRepository: TransactionRepository,
        private readonly promoCodeRepository: PromoCodeRepository,
        private readonly userDetailsRepository: UserDetailsRepository,
        private readonly walletService: WalletService,
        private readonly rideChannelService: RideChannelService,
        private readonly envService: EnvService,
        @InjectModel(AdminUser.name) private readonly adminModel: Model<AdminUserDocument>,
    ) {
        this.matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    }

    private async getSession(useTransactions: boolean): Promise<any> {
        if (!useTransactions) {
            return {
                withTransaction: async (fn: any) => await fn(),
                endSession: async () => { },
                inTransaction: false,
            };
        }
        const session = await this.connection.startSession();
        return session;
    }

    private isUsingAtlas(): boolean {
        const mongoUri = process.env.MONGODB_URI || '';
        return mongoUri.includes('mongodb.net') || mongoUri.includes('.mongodb.net');
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

        // Validate ride exists and is ended
        const ride = await this.ridesRepository.findById(new Types.ObjectId(rideId));
        if (!ride) {
            throw new NotFoundException('Ride not found');
        }

        if (!ride.rideEndedAt ) {
            throw new BadRequestException('Ride must be ended before payment');
        }

        // Check if already paid
        if (ride.paymentDetails?.paymentStatus === PaymentStatusEnum.PAID) {
            throw new BadRequestException('Ride has already been paid');
        }

        // Validate driver exists
        if (!ride.driverId) {
            throw new BadRequestException('Ride has no assigned driver');
        }
        const driver = await this.userDetailsRepository.findOne({ userId: ride.driverId });
        if (!driver) {
            throw ErrorException(null, "USER.NOT_FOUND", 404);
        }
        if (ride.isAcknowledgeByDriver === true) {
            throw new BadRequestException('Driver has already acknowledged the ride');
        }
        // Calculate fare breakdown
        const fareBreakdown = await this.calculateFareBreakdown(
            ride,
            promoCodeId, 
        );
        this.logger.log(`Fare breakdown for ride ${rideId}: ${JSON.stringify(fareBreakdown)}`);
        const admin = await this.adminModel.findOne().sort({ createdAt: 1 }).exec();
        this.adminId = admin?._id.toString() || '';
        const useTransactions = this.isUsingAtlas();
        const session = useTransactions ? await this.getSession(useTransactions) : null;
        try {
            if (useTransactions) {
                await session.withTransaction(async () => {
                    await this.processPaymentLogic(
                        ride,
                        passengerId,
                        paymentMethod,
                        fareBreakdown,
                        session,
                        promoCodeId,
                    );
                });
            } else {
                await this.processPaymentLogic(
                    ride,
                    passengerId,
                    paymentMethod,
                    fareBreakdown,
                    session,
                    promoCodeId,
                );
            }

            //check if driver exist

            this.logger.log(
                `Updating total earnings of the driver ${ride.driverId}, current earnings ${driver.totalEarnings}`,
            );
            this.logger.log(
                `Retrieving transaction of the driver ${ride.driverId} for ride ${ride._id.toString()}`,
            );
            //update total earnings in driver's user details entity
            //the data should be taken from transaction model with rideid this trip id and type ride payment and direction credit driver
            const transaction = await this.transactionRepository.findOne({
                tripId: ride._id.toString(),
                direction: TransactionDirection.CREDIT,
                type: TransactionType.RIDE_PAYMENT,
            });

            if (!transaction) {
                this.logger.warn(`No driver credit transaction found for ride ${ride._id.toString()}, skipping earnings update`);
            } else {
                this.logger.log(`Updated total earnings by ${transaction.amount}`);
                // $inc handles the case where totalEarnings field doesn't exist in the document -
                // MongoDB will create it with the increment value (e.g. if field is missing, it's treated as 0)
                const userDetails = await this.userDetailsRepository.findOneAndUpdate(
                    { driverId: ride.driverId },
                    {
                        $inc: { totalEarnings: transaction.amount },
                    },
                    { new: true }, // returns the updated document, not the pre-update one
                );

                if (!userDetails) {
                    this.logger.warn(`User details not found for driver ${ride.driverId}, skipping earnings update`);
                } else {
                    this.logger.log(
                        `Updated total earnings of the driver ${userDetails.totalEarnings ?? 0}`,
                    );
                }
            }
        } catch (error: any) {
            this.logger.error('Error occurred while processing payment', error);
            throw ErrorException(null, 'Payment processing failed: ' + error.message, 500);
        }
        finally {
            if (useTransactions) {
                await session.endSession();
            }
        }

        // ── Publish payment completed event to Ably ───────────────────
        await this.rideChannelService.publishRideEvent(ride.rideUUId, 'payment-completed', {
            rideId,
            rideUUId: ride.rideUUId,
            paymentMethod,
            paid: true,
            fareBreakdown,
            promocodeId: promoCodeId || null,
            promoCodeUsed: Boolean(promoCodeId)
        });
        this.logger.log(`Payment processed successfully for ride ${rideId}`);
        return {
            success: true,
            message: 'Payment processed successfully',
            rideId,
            rideUUId: ride.rideUUId,
            paymentMethod,
            fareBreakdown: {
                baseFare: fareBreakdown.baseFare,
                distanceCharge: fareBreakdown.distanceCharge,
                discount: fareBreakdown.discount,
                subTotal: fareBreakdown.subTotal,
                totalFare: fareBreakdown.totalFare,
            },
            transactions: (this as any)._transactions || [],
            paid: true,
        } as PassengerPaymentResult;
    }

    /**
     * Calculate fare breakdown with optional promo code discount.
     * Uses base fare and distance charge from the ride's already-computed fare object.
     * Only the promo code discount is calculated here.
     */
    private async calculateFareBreakdown(
        ride: RidesDocument,
        promoCodeId?: string,
     
    ): Promise<{ baseFare: number; distanceCharge: number; discount: number; subTotal: number; totalFare: number; commissionAmount: number; promoCodeName?: string }> {
        // Use base fare and distance charge from ride.fare (already calculated during ride completion)
        const baseFare = Number(ride.fare?.baseAmount || 0);
        const distanceCharge = Number(ride.fare?.distanceAmount || 0);

        let subTotal = Number(ride.fare?.subTotal || 0);
        let discount = Number(ride.fare?.discountAmount || 0);
        let promoCodeName: string | undefined;

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

            if (promoCode.minimumFare && subTotal < Number(promoCode.minimumFare)) {
                throw new BadRequestException(`Minimum fare of NPR ${promoCode.minimumFare} required`);
            }

            promoCodeName = promoCode.name;

            // Calculate discount
            if (promoCode.discountType === DiscountTypeEnum.PERCENTAGE && promoCode.percentageAmount) {
                discount = Number(ride.fare?.discountAmount || 0);
            } else if (promoCode.discountType === DiscountTypeEnum.FLAT && promoCode.flatAmount) {
                discount = Number(ride.fare?.discountAmount || 0);
            }
        }

        const totalFare = Number(ride.fare?.totalAmount || 0);
        const commissionAmountFromTotal = totalFare * 0.2; // Assuming 20% commission 

        return {
            baseFare,
            distanceCharge,
            discount,
            subTotal,
            totalFare,
            commissionAmount: Number(commissionAmountFromTotal.toFixed(2)),
            promoCodeName,
        };
    }

    /**
     * Create a transaction record.
     */
    private async processPaymentLogic(
        ride: RidesDocument,
        passengerId: string,
        paymentMethod: PaymentMethodEnum,
        fareBreakdown: any,
        session: any,
        promoCodeId?: string,
    ): Promise<void> {
        const transactions: {
            transactionId: string;
            userId: string;
            type: string;
            amount: number;
        }[] = [];
        console.log('Processing payment logic for ride:', ride._id.toString(), 'Passenger:', passengerId, 'Payment Method:', paymentMethod, 'Fare Breakdown:', fareBreakdown);
        const driverId = ride.driverId.toString();

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
                TransactionStatus.COMPLETED,
                session,
            );
            transactions.push({
                transactionId: passengerTxn._id.toString(),
                userId: passengerId,
                type: 'DEBIT',
                amount: fareBreakdown.totalFare,
            });

            // Credit driver (total - commission)
            const driverAmount = fareBreakdown.totalFare - fareBreakdown.commissionAmount;
            await this.walletService.creditWallet(driverId, driverAmount, session);

            const driverTxn = await this.createTransaction(
                driverId,
                TransactionDirection.CREDIT,
                TransactionType.RIDE_PAYMENT,
                driverAmount,
                paymentMethod,
                ride._id.toString(),
                passengerId,
                TransactionStatus.COMPLETED,
                session,
            );
            transactions.push({
                transactionId: driverTxn._id.toString(),
                userId: driverId,
                type: 'CREDIT',
                amount: driverAmount,
            });

            // Credit admin (commission = discount)

            const adminTxn = await this.createTransaction(
                this.adminId,
                TransactionDirection.CREDIT,
                TransactionType.COMMISSION,
                fareBreakdown.commissionAmount,
                paymentMethod,
                ride._id.toString(),
                passengerId,
                TransactionStatus.PENDING,
                session,
            );
            transactions.push({
                transactionId: adminTxn._id.toString(),
                userId: this.adminId,
                type: 'CREDIT',
                amount: fareBreakdown.commissionAmount,
            });

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
                TransactionStatus.COMPLETED,
                session,
            );
            transactions.push({
                transactionId: passengerTxn._id.toString(),
                userId: passengerId,
                type: 'DEBIT',
                amount: fareBreakdown.totalFare,
            });

            const driverAmount = fareBreakdown.totalFare - fareBreakdown.commissionAmount;
            const driverTxn = await this.createTransaction(
                driverId,
                TransactionDirection.CREDIT,
                TransactionType.RIDE_PAYMENT,
                driverAmount,
                paymentMethod,
                ride._id.toString(),
                passengerId,
                TransactionStatus.COMPLETED,
                session,
            );
            transactions.push({
                transactionId: driverTxn._id.toString(),
                userId: driverId,
                type: 'CREDIT',
                amount: driverAmount,
            });


            const adminTxn = await this.createTransaction(
                this.adminId,
                TransactionDirection.CREDIT,
                TransactionType.COMMISSION,
                fareBreakdown.commissionAmount,
                paymentMethod,
                ride._id.toString(),
                passengerId,
                TransactionStatus.PENDING,
                session,
            );
            transactions.push({
                transactionId: adminTxn._id.toString(),
                userId: this.adminId,
                type: 'CREDIT',
                amount: fareBreakdown.commissionAmount,
            });

        } else {
            throw new BadRequestException('Unsupported payment method');
        }

        // ── Update ride with payment details ──────────────────────
        const paymentDetails: PaymentDetails = {
            baseAmount: fareBreakdown.baseFare,
            distanceAmount: fareBreakdown.distanceCharge,
            totalAmount: fareBreakdown.totalFare,
            subTotal: fareBreakdown.subTotal,
            noOfPassengers: ride.noOfPassengers || 1,
            paymentMethod,
            discountAmount: fareBreakdown.discount,
            paymentStatus: PaymentStatusEnum.PAID,
            promoCodeId: promoCodeId ? new Types.ObjectId(promoCodeId) : null,
            promoCodeName: fareBreakdown.promoCodeName || null,
            driverCommission: 0.2,
        };

        await this.ridesModel.updateOne(
            { _id: ride._id },
            {
                $set: {
                    paymentDetails,
                    isAcknowledgeByDriver: paymentMethod === PaymentMethodEnum.CASH ? false : true,
                },
            },
            { session },
        );

       // Store transactions for response
        (this as any)._transactions = transactions;
    }

    private async createTransaction(
        userId: string,
        direction: TransactionDirection,
        type: TransactionType,
        amount: number,
        paymentMethod: PaymentMethodEnum,
        tripId: string,
        _relatedUserId: string,
        status: TransactionStatus,
        session?: any,
    ): Promise<TransactionDocument> {
        const transactionUuid = `${type}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        const isRider = direction === TransactionDirection.DEBIT && type === TransactionType.RIDE_PAYMENT;

        const [transaction] = await this.transactionRepository.createMany(
            [
                {
                    ...(isRider ? { riderId: userId } : type === TransactionType.RIDE_PAYMENT ? { driverId: userId } : {}),
                    tripId,
                    direction,
                    type,
                    amount,
                    paymentMethod,
                    status,
                    transactionUuid,
                    reference: `${type}-${tripId}`,
                },
            ],
            session,
        );

        return transaction as unknown as TransactionDocument;
    }


}