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
      totalAmount, commission, paymentMethod,import { PaginationInput, RidesRepository, User, RidesDocument, RideStatus, RideTypes, ProvinceEnum } from '@libs/data-access';
import { Types } from 'mongoose';
import { Injectable } from '@nestjs/common';

@Injectable()
export class RidesService {
  constructor(
    private readonly rideRepository: RidesRepository,
  ) {}

  /**
   * Fetches rides for the current user based on their role with pagination.
   * - If user role is USER: returns rides where user is the rider
   * - If user role is DRIVER: returns rides where user is the driver
   * - Vehicle data (model, name/type) is populated in the result
   * - Returns paginated results
   */
  async findRides(
    user: User,
    options: PaginationInput,
  ) {
    return this.rideRepository.findRidesByUserWithPagination(user, options);
  }

  /**
   * Creates a new ride with an auto-generated rideUUId using nanoid.
   * Also calculates timeToReachRiderInMinutes and timeToReachRider based on
   * distance and booking time before saving.
   */
  async createRide(rideData: Partial<RidesDocument>): Promise<RidesDocument> {
    return this.rideRepository.createRide(rideData);
  }

  /**
   * Starts a ride by setting rideStartedAt and updating ride status to ONGOING.
   * Calculates estimatedTimeInMinutes and estimatedFare based on distance.
   */
  async startRide(rideId: Types.ObjectId, startedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    return this.rideRepository.startRide(rideId, startedAt, distanceInKm);
  }

  /**
   * Completes a ride by setting rideCompletedAt, rideStatus to COMPLETED.
   * Calculates actual duration from rideStartedAt to rideCompletedAt for
   * estimatedTimeInMinutes and estimatedFare.
   */
  async completeRide(rideId: Types.ObjectId, completedAt: Date, distanceInKm?: number): Promise<RidesDocument | null> {
    return this.rideRepository.completeRide(rideId, completedAt, distanceInKm);
  }

  /**
   * Generates a specified number of sample rides for testing purposes.
   * This method creates 20 instant and 20 scheduled rides with varying statuses.
   * The rideUUId, estimatedFare, estimatedTimeInMinutes, timeToReachRiderInMinutes,
   * and timeToReachRider are automatically calculated by the pre-save hook.
   */
  async generateSampleRides(
    driverId: Types.ObjectId,
    riderId: Types.ObjectId,
    vehicleId: Types.ObjectId,
    countPerType: number = 20, // 20 instant, 20 scheduled
  ): Promise<RidesDocument[]> {
    const generatedRides: RidesDocument[] = [];
    const rideTypes = [RideTypes.INSTANT, RideTypes.SCHEDULED];

    for (const rideType of rideTypes) {
      for (let i = 0; i < countPerType; i++) {
        let rideStatus: RideStatus;
        let rideStartedAt: Date | undefined;
        let rideCompletedAt: Date | undefined;

        // Distribute statuses as requested: 10 confirmed, 3 ongoing, 2 completed, 2 canceled, 3 more confirmed
        if (i < 10) {
          rideStatus = RideStatus.CONFIRMED;
        } else if (i < 13) {
          rideStatus = RideStatus.ONGOING;
        } else if (i < 15) {
          rideStatus = RideStatus.COMPLETED;
        } else if (i < 17) {
          rideStatus = RideStatus.CANCELLED;
        } else {
          rideStatus = RideStatus.CONFIRMED; // Remaining 3 rides
        }

        const bookingTime = new Date(Date.now() - Math.random() * 3600000 * 24); // Random booking time within last 24 hours
        const distanceInKm = parseFloat((Math.random() * 15 + 2).toFixed(1)); // Random distance between 2.0 and 17.0 km

        if (rideStatus === RideStatus.ONGOING || rideStatus === RideStatus.COMPLETED) {
          rideStartedAt = new Date(bookingTime.getTime() + Math.random() * 10 * 60000); // Started 0-10 mins after booking
        }
        if (rideStatus === RideStatus.COMPLETED && rideStartedAt) {
          // Assuming average speed of 30km/h, so 2 minutes per km. Add some randomness.
          const travelTimeMs = distanceInKm * 2 * 60000 + Math.random() * 5 * 60000;
          rideCompletedAt = new Date(rideStartedAt.getTime() + travelTimeMs);
        }

        const rideData: Partial<RidesDocument> = {
          rideType: rideType,
          bookingTime: bookingTime,
          rideStatus: rideStatus,
          riderId: riderId,
          driverId: driverId,
          vehicleId: vehicleId,
          distanceInKm: distanceInKm,
          rideStartedAt: rideStartedAt,
          rideCompletedAt: rideCompletedAt,
          pickupLocation: {
            address: `Pickup ${rideType} ${i + 1}`,
            city: 'Kathmandu',
            province: ProvinceEnum.BAGMATI,
            district: 'Kathmandu',
            fullAddress: `Full Pickup Address ${i + 1}, Kathmandu`,
            type: 'Point',
            coordinates: [85.3 + Math.random() * 0.1, 27.7 + Math.random() * 0.1],
          } as any,
          dropoffLocation: {
            address: `Dropoff ${rideType} ${i + 1}`,
            city: 'Kathmandu',
            province: ProvinceEnum.BAGMATI,
            district: 'Kathmandu',
            fullAddress: `Full Dropoff Address ${i + 1}, Kathmandu`,
            type: 'Point',
            coordinates: [85.4 + Math.random() * 0.1, 27.8 + Math.random() * 0.1],
          } as any,
          deleted: false,
        };
        const newRide = await this.rideRepository.createRide(rideData);
        if (newRide.rideStatus === RideStatus.COMPLETED) {
  await this.transactionService.createRideTransactions({
    tripId: newRide._id,
    ...
  });
}

        generatedRides.push(newRide);
      }
    }
    return generatedRides;
  }
}

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