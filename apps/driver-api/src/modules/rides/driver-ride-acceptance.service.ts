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
import { CompleteRideInput, RidesRepository } from '@libs/data-access';
import { ErrorException, toMongoId } from '@libs/common';
import { DriverActionEnum } from '@libs/data-access/enums/matchmaking.enum';

// Cached GraphQL mutations to avoid string reconstruction on every call
const DRIVER_RESPONSE_MUTATION = `
  mutation DriverRespondToRide($input: DriverResponseInput!) {
    driverRespondToRide(input: $input) {
      success
      message
      acceptedDetails {
        rideId
        rideUUId
        driverId
        driverName
        driverImage
        rating
        vehicleType
        vehicleModel
        color
        numberPlate
        estimatedFare
        estimatedTimeInMinutes
        distanceInKm
        ablyChannelId
      }
    }
  }
`;

const COMPLETE_RIDE_MUTATION = `
  mutation CompleteRide($rideId: String!, $driverId: String!) {
    completeRide(rideId: $rideId, driverId: $driverId) {
      rideId
      rideUUId
      rideStatus
      totalDurationInMinutes
      totalDuration
      completedAt
      fareBreakdown {
        baseFare
        distanceCharge
        discount
        totalFare
      }
    }
  }
`;

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
  private matchmakingUrl: string;

  constructor(
    private readonly ridesRepository: RidesRepository,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly rideChannelService: RideChannelService,
    private readonly envService: EnvService,
    private readonly s3: S3Service,
  ) { }

  onModuleInit() {
    this.logger.log('Driver ride acceptance service initialized. Awaiting driver authentication.');
    // Cache the matchmaking URL on initialization instead of fetching it on every request
    this.matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
  }

  /**
   * Subscribe a specific driver to ride requests.
   * Called when a driver comes online.
   * Note: The driver receives ride details via the unified ride channel.
   */
  async subscribeForDriver(_driverId: string): Promise<void> {
    this.logger.log(`Driver ${_driverId} is now ready to receive ride events via unified channel`);
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

    this.logger.debug(`Calling matchmaking service for ride acceptance. rideUUID=${ride.rideUUId}`);

    try {
      const result = await this.callMatchmakingService<{ driverName?: string; driverImage?: string; rating?: number; vehicleType?: string; vehicleModel?: string; color?: string; numberPlate?: string; estimatedFare?: number; estimatedTimeInMinutes?: number; distanceInKm?: number; }>({
        rideUUID: ride.rideUUId,
        driverId,
        rideId,
        action: 'ACCEPT',
      });

      if (result?.success) {
        this.logger.log(`Driver ${driverId} successfully accepted ride ${rideId} via matchmaking service`);
        const mmDetails = result.acceptedDetails;

        // Build response primarily from matchmaking service data (which is authoritative)
        // Only fetch additional data if matchmaking service doesn't provide it
        const acceptDetails: DriverAcceptDetails = {
          rideId: ride._id.toString(),
          rideUUId: ride.rideUUId,
          driver: {
            driverId,
            fullName: mmDetails?.driverName || 'Driver',
            phone: '',
            profileImage: mmDetails?.driverImage || null,
            rating: mmDetails?.rating || 0,
          },
          vehicle: {
            vehicleId: '',
            vehicleModel: mmDetails?.vehicleModel || '',
            vehicleType: mmDetails?.vehicleType || '',
            color: mmDetails?.color || '',
            numberPlate: mmDetails?.numberPlate || '',
            year: 0,
          },
          passenger: {
            passengerId: ride.passengerId.toString(),
            fullName: 'Passenger',
            phone: '',
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
          estimatedFare: mmDetails?.estimatedFare || ride.estimatedFare || 0,
          estimatedTimeInMinutes: mmDetails?.estimatedTimeInMinutes || ride.estimatedTimeInMinutes || 0,
          distanceInKm: mmDetails?.distanceInKm || ride.distanceInKm || 0,
          acceptedAt: new Date().toISOString(),
        };

        await this.rideChannelService.publishRideEvent(ride.rideUUId, 'driver-response', { driverId, action: DriverActionEnum.ACCEPT });
        return { success: true, message: result.message, data: acceptDetails };
      } else {
        this.logger.warn(`Matchmaking service returned: ${result?.message}`);
        return { success: false, message: result?.message || 'Failed to accept ride via matchmaking service' };
      }
    } catch (error: any) {
      this.logger.error(`Failed to accept ride: ${error?.message || error}`);
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

    try {
      const result = await this.callMatchmakingService({
        rideId,
        rideUUID: ride.rideUUId,
        driverId,
        action: 'REJECT',
      });

      if (result?.success) {
        this.logger.log(`Driver ${driverId} successfully rejected ride ${rideId}`);
        await this.rideChannelService.publishRideEvent(ride.rideUUId, 'driver-response', { driverId, action: DriverActionEnum.REJECT });
        return { success: true, message: result.message };
      } else {
        return { success: false, message: result?.message || 'Failed to reject ride via matchmaking service' };
      }
    } catch (error: any) {
      this.logger.error(`Failed to reject ride: ${error?.message || error}`);
      return { success: false, message: 'Failed to communicate with matchmaking service' };
    }
  }

  /**
   * Build the full acceptance payload with driver, vehicle, and passenger details.
   * This method fetches data from the database and should be used when detailed information is needed.
   */
  async buildAcceptDetails(ride: RidesDocument, driverId: string): Promise<DriverAcceptDetails> {
    const driverObjectId = new Types.ObjectId(driverId);

    // Fetch all required data in parallel for better performance
    const [driverUser, driverDetails, vehicle, passengerUser] = await Promise.all([
      this.userModel.findById(driverObjectId).exec(),
      this.userDetailsModel.findOne({ userId: driverObjectId }).exec(),
      this.vehicleModel.findOne({ driverId: driverObjectId }).exec(),
      this.userModel.findById(ride.passengerId).exec(),
    ]);

    return {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      driver: {
        driverId,
        fullName: driverUser?.fullName || 'Driver',
        phone: driverUser?.phone || '',
        profileImage: driverDetails?.profileImages?.length > 0 ? getActiveProfileImageUrl(driverDetails.profileImages, (key) => this.s3.getPublicUrl(key)) : null,
        rating: driverDetails?.rating || 0,
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

  async completeRide(input: CompleteRideInput, driverId: string): Promise<Rides> {
    const { rideId } = input || {};

    if (!rideId) {
      throw ErrorException(null, 'RIDES.RIDE_ID_REQUIRED', 400);
    }

    this.logger.log(`Driver ${driverId} attempting to complete ride ${rideId}`);

    try {
      const response = await axios.post(
        `${this.matchmakingUrl}/graphql`,
        {
          query: COMPLETE_RIDE_MUTATION,
          variables: { rideId, driverId },
        },
      );

      const result = response.data?.data?.completeRide;
      if (!result) {
        const errorMsg = response.data?.errors?.[0]?.message || 'Failed to complete ride via matchmaking service';
        this.logger.error(`Matchmaking completeRide failed: ${JSON.stringify(response.data?.errors)}`);
        throw ErrorException(null, errorMsg, 500);
      }

      // Fetch the updated ride to return
      const updatedRide = await this.ridesRepository.findById(toMongoId(rideId));
      if (!updatedRide) {
        throw ErrorException(null, 'RIDES.RIDE_NOT_FOUND', 404);
      }
      return updatedRide;
    } catch (err: any) {
      this.logger.error(`Failed to complete ride: ${err?.message || err}`);
      // Re-throw HttpException as-is
      if (err?.response || err?.status) {
        throw err;
      }
      throw ErrorException(null, 'Failed to call the matchmaking service', 500);
    }
  }

  /**
   * Shared method to call the matchmaking service GraphQL endpoint.
   */
  private async callMatchmakingService<T = any>(variables: { rideUUID: string; driverId: string; action: string; rideId?: string }): Promise<{ success: boolean; message: string; acceptedDetails?: T } | null> {
    try {
      const response = await axios.post(
        `${this.matchmakingUrl}/graphql`,
        {
          query: DRIVER_RESPONSE_MUTATION,
          variables,
        },
      );
      return response.data?.data?.driverRespondToRide || null;
    } catch (error: any) {
      this.logger.error(`Matchmaking service call failed: ${error?.message || error}`);
      throw error;
    }
  }
}
