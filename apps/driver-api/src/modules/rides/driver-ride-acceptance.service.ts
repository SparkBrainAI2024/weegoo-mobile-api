import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { User, UserDocument } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideChannelService } from '@libs/services/ably';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';
import { S3Service } from '@libs/s3/s3.service';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { PaymentMethodEnum } from '@libs/data-access/enums/payment.enum';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { CompleteRideInput, RidesRepository } from '@libs/data-access';
import { ErrorException, MATCHMAKING_CONFIG, toMongoId } from '@libs/common';

export interface DriverAcceptDetails {
  rideId: string;
  rideUUId: string;
  driver: {
    driverId: string;
    fullName: string;
    phone: string;
    profileImage?: string;
    rating: number;
  };
  vehicle: {
    vehicleId: string;
    vehicleModel: string;
    vehicleType: string;
    color: string;
    numberPlate: string;
    year: number;
  };
  passenger: {
    passengerId: string;
    fullName: string;
    phone: string;
  };
  pickupLocation: {
    address: string;
    coordinates: [number, number];
    city?: string;
  };
  dropoffLocation?: {
    address: string;
    coordinates: [number, number];
    city?: string;
  };
  estimatedFare: number;
  estimatedTimeInMinutes: number;
  distanceInKm: number;
  acceptedAt: string;
}

@Injectable()
export class DriverRideAcceptanceService {
  private readonly logger = new Logger(DriverRideAcceptanceService.name);
  private driverId: string;

  constructor(
    private readonly ridesRepository: RidesRepository,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly rideChannelService: RideChannelService,
    private readonly envService: EnvService,
    private readonly s3: S3Service,
    private readonly transactionService: TransactionService,
  ) { }

  onModuleInit() {
    this.logger.log('Driver ride acceptance service initialized. Awaiting driver authentication.');
  }

  /**
   * Subscribe a specific driver to ride requests.
   * Called when a driver comes online.
   * Note: The driver receives ride details via the unified ride channel.
   * This can be called when a driver needs to listen to a specific ride's events.
   */
  async subscribeForDriver(driverId: string): Promise<void> {
    this.driverId = driverId;
    this.logger.log(`Driver ${driverId} is now ready to receive ride events via unified channel`);
  }

  /**
   * Driver accepts a ride.
   * Calls the matchmaking service GraphQL endpoint which handles atomic lock, DB update,
   * Ably publishing, and notifications.
   */
  async acceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string; data?: DriverAcceptDetails }> {
    this.logger.log(`Driver ${driverId} attempting to accept ride ${rideId}`);

    const ride = await this.ridesRepository.findById(toMongoId(rideId));
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    // Call matchmaking service via GraphQL
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000');
    this.logger.log(`Calling matchmaking service at ${matchmakingUrl} for ride acceptance`);
    this.logger.debug(`Payload: rideUUID=${ride.rideUUId}, driverId=${driverId}, action=accept ,rideId=${rideId}`);
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation DriverRespondToRide($input: DriverResponseInput!) {
              driverRespondToRide(input: $input) {
                success
                message
              }
            }
          `,
          variables: {
            input: {
              rideUUID: ride.rideUUId,
              driverId,
              rideId,
              action: 'ACCEPT',
            },
          },
        },
        { timeout: 10000 },
      );

      const result = response.data?.data?.driverRespondToRide;
      if (result?.success) {
        this.logger.log(`Driver ${driverId} successfully accepted ride ${rideId} via matchmaking service`);
        return { success: true, message: result.message };
      } else {
        this.logger.warn(`Matchmaking service returned: ${result?.message}`);
        return { success: false, message: result?.message || 'Failed to accept ride via matchmaking service' };
      }
    } catch (error: any) {
      this.logger.error(`Failed to call matchmaking service for accept: ${error?.message || error}`);
      return { success: false, message: 'Failed to communicate with matchmaking service' };
    }
  }

  /**
   * Driver rejects a ride.
   * Calls the matchmaking service GraphQL endpoint which handles notifications and continues matchmaking.
   */
  async rejectRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} rejected ride ${rideId}`);

    const ride = await this.ridesRepository.findById(toMongoId(rideId));
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    // Call matchmaking service via GraphQL
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation DriverRespondToRide($input: DriverResponseInput!) {
              driverRespondToRide(input: $input) {
                success
                message
              }
            }
          `,
          variables: {
            input: {
              rideId,
              rideUUID: ride.rideUUId,
              driverId,
              action: 'REJECT',
            },
          },
        },
        { timeout: 10000 },
      );

      const result = response.data?.data?.driverRespondToRide;
      if (result?.success) {
        this.logger.log(`Driver ${driverId} rejected ride ${rideId} via matchmaking service`);
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result?.message || 'Failed to reject ride via matchmaking service' };
      }
    } catch (error: any) {
      this.logger.error(`Failed to call matchmaking service for reject: ${error?.message || error}`);
      return { success: false, message: 'Failed to communicate with matchmaking service' };
    }
  }

  /**
   * Build the full acceptance payload with driver, vehicle, and passenger details.
   */
  private async buildAcceptDetails(ride: RidesDocument, driverId: string): Promise<DriverAcceptDetails> {
    // Fetch driver user
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();

    // Fetch driver's vehicle
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();

    // Fetch passenger details
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();

    return {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      driver: {
        driverId: driverId,
        fullName: driverUser?.fullName || 'Driver',
        phone: driverUser?.phone || '',
        profileImage: driverDetails?.profileImages?.length > 0 ? getActiveProfileImageUrl(driverDetails.profileImages, (key) => this.s3.getPublicUrl(key)) : null,
        rating: 4.5, // placeholder — fetch from ratings collection in production
      },
      vehicle: {
        vehicleId: vehicle?._id?.toString() || '',
        vehicleModel: vehicle?.vehicleModel || '',
        vehicleType: vehicle?.vehicleType || '',
        color: vehicle?.color || '',
        numberPlate: vehicle?.numberPlate || '',
        year: vehicle?.year || 0,
      },
      passenger: {
        passengerId: ride.passengerId.toString(),
        fullName: passengerUser?.fullName || 'Passenger',
        phone: passengerUser?.phone || '',
      },
      pickupLocation: {
        address: ride.pickupLocation?.address || '',
        coordinates: ride.pickupLocation?.coordinates || [0, 0],
        city: ride.pickupLocation?.city,
      },
      dropoffLocation: ride.dropoffLocation ? {
        address: ride.dropoffLocation.address,
        coordinates: ride.dropoffLocation.coordinates,
        city: ride.dropoffLocation.city,
      } : undefined,
      estimatedFare: ride.estimatedFare || 0,
      estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
      distanceInKm: ride.distanceInKm || 0,
      acceptedAt: new Date().toISOString(),
    };
  }

  /**
   * Complete a ride. Called by driver when ride is finished.
   * Handles:
   * 1. Validating ride status and ownership
   * 2. Calculating final fare
   * 3. Creating transactions (passenger debit, driver credit, admin commission)
   * 4. Updating ride status to COMPLETED
   * 5. Updating payment details
   */
  async completeRide(input: CompleteRideInput, driverId: string): Promise<Rides> {
    const { rideId, paymentMethod } = input || {};

    if (!rideId) {
      throw ErrorException(null, 'RIDES.RIDE_ID_REQUIRED', 400);
    }

    this.logger.log(`Driver ${driverId} attempting to complete ride ${rideId}`);

    // 1. Find the ride
    const ride = await this.ridesRepository.findById(toMongoId(rideId));
    this.logger.debug(`Ride found: ${ride ? 'Yes' : 'No'}`);
    const vehicle = await this.vehicleModel.findById(ride?.vehicleId).exec();
    if (!ride) {
      throw ErrorException(null, 'RIDES.RIDE_NOT_FOUND', 404)
    }

    // 2. Validate ride belongs to this driver
    if (ride.driverId?.toString() !== driverId) {
      throw ErrorException(null, 'RIDES.NOT_ASSOCIATED_WITH_DRIVER', 404)
    }

    // 3. Validate ride is in ONGOING status
    if (ride.rideStatus !== RideStatus.ONGOING) {
      throw ErrorException(null, 'RIDES.INVALID_STATUS', 400)
    }

    // 4. Calculate final fare
    const distanceInKm = ride.distanceInKm || 0;
    const durationInMinutes = ride.estimatedTimeInMinutes || 0;

    // Fare calculation constants
    const baseFare = MATCHMAKING_CONFIG.FARE.BASE_PICKUP_COST[vehicle?.vehicleType] || 0;
    const perKmRate = MATCHMAKING_CONFIG.FARE[vehicle?.vehicleType]?.PER_KM_RATE || 0;
    const perMinuteRate = MATCHMAKING_CONFIG.FARE[vehicle?.vehicleType]?.PER_MINUTE_RATE || 0;

    const baseFareAmount = Number(baseFare);
    const distanceFare = Number(distanceInKm) * Number(perKmRate);
    const durationFare = Number(durationInMinutes) * Number(perMinuteRate);
    const totalFare = Number(baseFareAmount) + Number(distanceFare) + Number(durationFare);

    // 5. Get discount from payment details
    const discountAmount = Number(ride.paymentDetails?.discountAmount || 0);
    const finalAmount = totalFare - discountAmount;

    // 6. Calculate commission (default 20% if not set)
    const commissionRate = Number(ride.paymentDetails?.driverCommission) || 0.2;
    const commissionAmount = Math.round(finalAmount * commissionRate * 100) / 100;
    const driverEarning = Math.round((finalAmount - commissionAmount) * 100) / 100;

    // 7. Get admin user ID (system admin)
    const adminUser = await this.userModel.findOne({ loginAs: 'ADMIN' } as any).exec();
    const adminId = adminUser?._id?.toString() || driverId; // fallback to driverId if no admin found

    // 8. Create transactions atomically
    try {
      await this.transactionService.createRideTransactions({
        tripId: rideId,
        riderId: ride.passengerId.toString(),
        driverId: driverId,
        adminId: adminId,
        totalFare: finalAmount,
        commission: commissionAmount,
        paymentMethod: paymentMethod || PaymentMethodEnum.CASH,
      });

      this.logger.log(`Transactions created for ride ${rideId}: passenger debit $${finalAmount}, driver credit $${driverEarning}, admin commission $${commissionAmount}`);
    } catch (error: any) {
      this.logger.error(`Failed to create transactions for ride ${rideId}: ${error?.message || error}`);
      throw ErrorException(null, 'COMMON.FAILED_TO_CREATE', 500);
    }

    // 9. Update ride status and payment details
    const updatedRide = await this.ridesRepository.updateById(
      toMongoId(rideId),
      {
        $set: {
          rideStatus: RideStatus.COMPLETED,
          rideCompletedAt: new Date(),
          distanceInKm: distanceInKm,
          estimatedTimeInMinutes: durationInMinutes,
          estimatedFare: totalFare,
          paymentDetails: {
            baseAmount: baseFareAmount,
            distanceAmount: distanceFare,
            totalAmount: finalAmount,
            noOfPassengers: ride.noOfPassengers || 1,
            paymentMethod: paymentMethod || PaymentMethodEnum.CASH,
            discountAmount: discountAmount,
            promoCodeId: ride.paymentDetails?.promoCodeId || null,
            driverCommission: Number(commissionRate),
          },
        },
      },
    )
    // Release the Ably channel after ride completion
    if (updatedRide?.rideUUId) {
      this.rideChannelService.releaseRideChannel(updatedRide.rideUUId);
    }

    return updatedRide
  }

}