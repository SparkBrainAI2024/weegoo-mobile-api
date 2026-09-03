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
import { Availability, AvailabilityDocument } from '@libs/data-access/entities/availability.entity';
import { RideTypes, RideStatus } from '@libs/data-access/enums/rides.enum';

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
        @InjectModel(Availability.name) private readonly availabilityModel: Model<AvailabilityDocument>,
    ) {
        this.matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    }

    /** Haversine great-circle distance (km) between two coordinate pairs. */
    private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const toRad = (x: number) => (x * Math.PI) / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    /**
     * Road distance & duration between two coordinates via the Baato routing
     * API (same service used by matchmaking's DistanceCalculatorService).
     * Falls back to the haversine estimate only when Baato is not configured
     * or the request fails.
     */
    private async getBaatoRoute(
        originLat: number,
        originLng: number,
        destLat: number,
        destLng: number,
    ): Promise<{ distanceKm: number; durationMinutes: number }> {
        const apiKey = this.envService.getBaatoApiKey();
        const baseUrl = this.envService.getBaatoApiUrl();

        if (!apiKey || !baseUrl) {
            this.logger.warn('Baato API not configured. Using haversine fallback.');
            return this.haversineEstimate(originLat, originLng, destLat, destLng);
        }

        try {
            const params = new URLSearchParams();
            params.append('key', apiKey);
            params.append('points[]', `${originLat},${originLng}`);
            params.append('points[]', `${destLat},${destLng}`);
            params.append('mode', 'car');

            const response = await axios.get(`${baseUrl}/directions`, { params });
            const route = response.data?.data?.[0];
            if (route && route.distanceInMeters != null) {
                const distanceKm = Number((route.distanceInMeters / 1000).toFixed(2));
                // Baato time is in ms; fall back to the speed estimate when absent.
                const durationMinutes = route.timeInMs != null
                    ? Math.max(1, Math.ceil(route.timeInMs / 1000 / 60))
                    : this.estimateDurationMinutes(distanceKm);
                return { distanceKm, durationMinutes };
            }

            this.logger.warn(
                `Baato returned no routes (${originLat},${originLng} → ${destLat},${destLng}). Using haversine fallback.`,
            );
            return this.haversineEstimate(originLat, originLng, destLat, destLng);
        } catch (error: any) {
            const detail = error?.response?.data
                ? JSON.stringify(error.response.data)
                : error?.message;
            this.logger.error(`Baato API error: ${detail}. Using haversine fallback.`);
            return this.haversineEstimate(originLat, originLng, destLat, destLng);
        }
    }

    /** Haversine distance/duration fallback when Baato is unavailable. */
    private haversineEstimate(
        originLat: number,
        originLng: number,
        destLat: number,
        destLng: number,
    ): { distanceKm: number; durationMinutes: number } {
        const distanceKm = Number(
            this.haversineKm(originLat, originLng, destLat, destLng).toFixed(2),
        );
        return { distanceKm, durationMinutes: this.estimateDurationMinutes(distanceKm) };
    }

    /** Average urban speed ~30 km/h; minimum 5 minutes. */
    private estimateDurationMinutes(distanceKm: number): number {
        return Math.max(5, Math.ceil((distanceKm / 30) * 60));
    }

    private utcStartOfDay(d: Date): Date {
        const x = new Date(d);
        x.setUTCHours(0, 0, 0, 0);
        return x;
    }

    /**
     * Book a PENDING scheduled ride with a specific driver.
     *
     * - Resolves the driver's availability day from the ride's bookingTime.
     * - Charges the ride amount from the passenger's WALLET; fails validation
     *   when the balance is insufficient.
     * - Inside a single MongoDB transaction session: debits the passenger,
     *   credits the driver (amount - commission) and credits the admin
     *   (commission), creates the transaction records, and updates the ride
     *   with the availability-day schedule info, driver-to-pickup distance /
     *   ETA, fare details and paymentStatus = PAID.
     */
    async bookScheduledRide(
        rideId: string,
        driverId: string,
        passengerId: string,
        clientAmount?: number,
    ): Promise<PassengerPaymentResult> {
        this.logger.log(`Booking scheduled ride ${rideId} with driver ${driverId} for passenger ${passengerId}`);

        // ── Validate ride ─────────────────────────────────────────
        const ride = await this.ridesRepository.findById(new Types.ObjectId(rideId));
        if (!ride) {
            throw new NotFoundException('Ride not found');
        }
        if (ride.rideType !== RideTypes.SCHEDULED) {
            throw new BadRequestException('Only scheduled rides can be booked');
        }
        if (ride.rideStatus !== RideStatus.BOOKING) {
            throw new BadRequestException(`Ride is not in BOOKING status. Current: ${ride.rideStatus}`);
        }
        if (ride.passengerId?.toString() !== passengerId) {
            throw new BadRequestException('This ride does not belong to you');
        }
        if (ride.paymentDetails?.paymentStatus === PaymentStatusEnum.PAID) {
            throw new BadRequestException('Ride has already been booked and paid');
        }
        if (ride.driverId) {
            throw new BadRequestException('Ride has already been booked by a driver');
        }
        if (!ride.bookingTime) {
            throw new BadRequestException('Ride has no booking time');
        }

        // ── Resolve the driver's availability day from the booking time ──
        const availabilityDoc = await this.availabilityModel
            .findOne({ driverId: new Types.ObjectId(driverId), deleted: false })
            .exec();
        if (!availabilityDoc || !availabilityDoc.days?.length) {
            throw new BadRequestException('Driver has no availability');
        }
        const targetDate = this.utcStartOfDay(new Date(ride.bookingTime));
        const day = availabilityDoc.days.find(
            (d) =>
                d &&
                this.utcStartOfDay(new Date(d.date)).getTime() === targetDate.getTime() &&
                d.isAvailableForBookings !== false,
        );
        if (!day) {
            throw new BadRequestException('Driver is not available on the ride booking date');
        }
        if ((ride.noOfPassengers || 1) > (day.availableSeats || 0)) {
            throw new BadRequestException(`Not enough available seats on the driver's availability day`);
        }
        const seatsBooked = ride.noOfPassengers || 1;
        if (seatsBooked < 1) {
            throw new BadRequestException(`Invalid number of seats booked`);
        }

        // ── Booking amount validation ──────────────────────────────
        // The payable amount is the driver's availability-day (per-seat)
        // amount multiplied by the number of seats being booked. The wallet
        // is ALWAYS charged this server-computed amount — never a client-
        // supplied value.
        const perSeatAmount = day.amount ?? 0;
        if (perSeatAmount <= 0) {
            throw new BadRequestException(`No booking amount configured for the driver's availability day`);
        }
        const amount = Number((perSeatAmount * seatsBooked).toFixed(2));
        if (amount <= 0) {
            throw new BadRequestException(`Invalid booking amount for the driver's availability day`);
        }
        // Cross-check the client-supplied expected amount when provided.
        if (clientAmount != null) {
            const normalizedClientAmount = Number(clientAmount);
            if (!Number.isFinite(normalizedClientAmount)) {
                throw new BadRequestException(`Invalid booking amount provided`);
            }
            if (Math.abs(normalizedClientAmount - amount) > 0.01) {
                throw new BadRequestException(
                    `Booking amount mismatch. Expected: ${amount} (day amount ${perSeatAmount} x ${seatsBooked} seat(s)), received: ${normalizedClientAmount}`,
                );
            }
        }

        // Slot window: request must be made before the buffer window opens,
        // or at/after the slot start time (consistent with matchmaking).
        if (day.timeSlots?.length) {
            const bufferMinutes = day.pickupBufferTimeMinutes || 0;
            const bookingTime = new Date(ride.bookingTime).getTime();
            const matchesSlot = day.timeSlots.some((s) => {
                if (!s?.startTime) return false;
                const start = new Date(s.startTime);
                if (isNaN(start.getTime())) return false;
                return (
                    bookingTime >= start.getTime() ||
                    bookingTime <= start.getTime() - bufferMinutes * 60000
                );
            });
            if (!matchesSlot) {
                throw new BadRequestException(`Booking time does not match any of the driver's time slots`);
            }
        }

        return this.executeScheduledBooking(ride, driverId, passengerId, day, amount);
    }

    /**
     * Runs the wallet transfer + ride update for a scheduled booking inside a
     * MongoDB transaction session (falls back to non-transactional execution
     * when the deployment doesn't support transactions).
     */
    private async executeScheduledBooking(
        ride: RidesDocument,
        driverId: string,
        passengerId: string,
        day: any,
        amount: number,
    ): Promise<PassengerPaymentResult> {
        // ── Wallet balance validation ─────────────────────────────
        const balance = await this.walletService.getBalance(passengerId);
        if (balance < amount) {
            throw new BadRequestException(
                `Insufficient wallet balance. Required: ${amount}, Available: ${balance}. Please top up your wallet.`,
            );
        }

        // ── Distance / ETA from ride pickup to the availability-day pickup ──
        // Road route via the Baato routing API (haversine fallback when
        // Baato is unavailable).
        const rideCoords = ride.pickupLocation?.coordinates;
        const dayPickup = day.pickupLocation;
        let distanceInKm = 0;
        let estimatedTimeInMinutes = 0;
        if (rideCoords?.length === 2 && dayPickup?.latitude != null && dayPickup?.longitude != null) {
            const route = await this.getBaatoRoute(
                rideCoords[1],
                rideCoords[0],
                dayPickup.latitude,
                dayPickup.longitude,
            );
            distanceInKm = route.distanceKm;
            estimatedTimeInMinutes = route.durationMinutes;
        }

        const commissionRate = 0.2;
        const commissionAmount = Number((amount * commissionRate).toFixed(2));
        const driverAmount = Number((amount - commissionAmount).toFixed(2));

        const admin = await this.adminModel.findOne().sort({ createdAt: 1 }).exec();
        this.adminId = admin?._id.toString() || '';

        const useTransactions = this.isUsingAtlas();
        const session = useTransactions ? await this.getSession(useTransactions) : null;
        const transactions: { transactionId: string; userId: string; type: string; amount: number }[] = [];

        try {
            const bookingLogic = async () => {
                // Debit passenger wallet for the day amount
                await this.walletService.debitWallet(passengerId, amount, session);
                const passengerTxn = await this.createTransaction(
                    passengerId,
                    TransactionDirection.DEBIT,
                    TransactionType.RIDE_PAYMENT,
                    amount,
                    PaymentMethodEnum.WALLET,
                    ride._id.toString(),
                    driverId,
                    TransactionStatus.COMPLETED,
                    session,
                );
                transactions.push({ transactionId: passengerTxn._id.toString(), userId: passengerId, type: 'DEBIT', amount });

                // Credit driver wallet (amount - commission)
                await this.walletService.creditWallet(driverId, driverAmount, session);
                const driverTxn = await this.createTransaction(
                    driverId,
                    TransactionDirection.CREDIT,
                    TransactionType.RIDE_PAYMENT,
                    driverAmount,
                    PaymentMethodEnum.WALLET,
                    ride._id.toString(),
                    passengerId,
                    TransactionStatus.COMPLETED,
                    session,
                );
                transactions.push({ transactionId: driverTxn._id.toString(), userId: driverId, type: 'CREDIT', amount: driverAmount });

                // Credit admin wallet (commission)
                const adminTxn = await this.createTransaction(
                    this.adminId,
                    TransactionDirection.CREDIT,
                    TransactionType.COMMISSION,
                    commissionAmount,
                    PaymentMethodEnum.WALLET,
                    ride._id.toString(),
                    passengerId,
                    TransactionStatus.COMPLETED,
                    session,
                );
                transactions.push({ transactionId: adminTxn._id.toString(), userId: this.adminId, type: 'CREDIT', amount: commissionAmount });

                await this.applyScheduledBookingToRide(ride, driverId, day, amount, distanceInKm, estimatedTimeInMinutes, commissionRate, session);
            };

            if (useTransactions) {
                await session.withTransaction(bookingLogic);
            } else {
                await bookingLogic();
            }
        } finally {
            await session?.endSession?.();
        }

        this.logger.log(`Scheduled ride ${ride.rideUUId} booked: passenger -${amount}, driver +${driverAmount}, admin commission +${commissionAmount}`);

        return {
            success: true,
            message: `Scheduled ride booked successfully with the driver for ${day.day}. Payment completed from wallet.`,
            rideId: ride._id.toString(),
            rideUUId: ride.rideUUId,
            paymentMethod: PaymentMethodEnum.WALLET,
            fareBreakdown: {
                baseFare: 0,
                distanceCharge: 0,
                discount: 0,
                subTotal: amount,
                totalFare: amount,
            },
            transactions,
            paid: true,
        };
    }

    /** Update the ride document with booking schedule, fare and payment info. */
    private async applyScheduledBookingToRide(
        ride: RidesDocument,
        driverId: string,
        day: any,
        amount: number,
        distanceInKm: number,
        estimatedTimeInMinutes: number,
        commissionRate: number,
        session: any,
    ): Promise<void> {
        const paymentDetails: PaymentDetails = {
            baseAmount: amount,
            distanceAmount: 0,
            totalAmount: amount,
            subTotal: amount,
            noOfPassengers: ride.noOfPassengers || 1,
            paymentMethod: PaymentMethodEnum.WALLET,
            discountAmount: 0,
            paymentStatus: PaymentStatusEnum.PAID,
            driverCommission: commissionRate,
        };

        await this.ridesModel.updateOne(
            { _id: ride._id, rideStatus: RideStatus.BOOKING },
            {
                $set: {
                    driverId: new Types.ObjectId(driverId),
                    schedule: {
                        bookingType: 'SCHEDULED',
                        bookingTime: ride.bookingTime,
                        bookingDate: this.utcStartOfDay(new Date(ride.bookingTime)),
                        day: day.day,
                        noOfPassengers: ride.noOfPassengers || 1,
                        vehicleType: day.vehicleType,
                        isFlexible: false,
                        pickupBufferTimeMinutes: day.pickupBufferTimeMinutes || 0,
                        timeSlots: (day.timeSlots || []).map((s: any) => ({ startTime: s.startTime })),
                        availabilityDayId: day._id?.toString() || null,
                    },
                    distanceInKm,
                    estimatedTimeInMinutes,
                    estimatedFare: amount,
                    fare: {
                        baseAmount: amount,
                        subTotal: amount,
                        trafficCongestionAmount: 0,
                        distanceAmount: 0,
                        totalAmount: amount,
                        noOfPassengers: ride.noOfPassengers || 1,
                        discountAmount: 0,
                        promoCodeId: null,
                    },
                    paymentDetails,
                    rideStatus: RideStatus.CONFIRMED,
                    isAcknowledgeByDriver: false,
                },
            },
            { session },
        );

        // ── Decrement seats on the booked availability day ─────────
        // Match the exact stored day by its concrete date and reduce the
        // available seat count by the number of passengers booked.
        //
        // `$elemMatch` binds BOTH the date and the remaining-seat guard to the
        // SAME day element, so we only decrement the specific day being booked
        // and never drive its seats below the requested passenger count. This
        // is atomic with respect to concurrent bookings (no overselling).
        const seatBooking = ride.noOfPassengers || 1;
        const seatsDecrement = await this.availabilityModel.updateOne(
            {
                driverId: new Types.ObjectId(driverId),
                deleted: false,
                days: {
                    $elemMatch: {
                        date: day.date,
                        availableSeats: { $gte: seatBooking },
                    },
                },
            },
            {
                $inc: { 'days.$.availableSeats': -seatBooking },
            },
            { session },
        );

        // If the atomic update changed nothing, the day no longer has enough
        // remaining seats (e.g. another passenger booked concurrently after our
        // earlier capacity check) => roll the whole booking back via the error.
        if (seatsDecrement.modifiedCount === 0) {
            throw new BadRequestException(
                `Not enough available seats on the driver's availability day`,
            );
        }
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
                    rideStatus: paymentMethod === PaymentMethodEnum.CASH ? ride.rideStatus : 'COMPLETED', // If cash, keep the ride status as is; if wallet, mark as completed
                    rideCompletedAt: paymentMethod === PaymentMethodEnum.CASH ? ride?.rideCompletedAt||null : new Date(), // If cash, keep the ride completed time as is; if wallet, set to now
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