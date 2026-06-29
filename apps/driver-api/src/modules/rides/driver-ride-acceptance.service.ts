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
import { CompleteRideInput, DriverRideResponse, RidesRepository } from '@libs/data-access';
import { ErrorException, toMongoId } from '@libs/common';

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
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    this.logger.log(`Calling matchmaking service at ${matchmakingUrl} for ride acceptance`);
    this.logger.debug(`Payload: rideUUID=${ride.rideUUId}, driverId=${driverId}, action=accept ,rideId=${rideId}`);
    // Pre-fetch driver and vehicle info for building the response
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
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
      );

      const result = response.data?.data?.driverRespondToRide;
      if (result?.success) {
        this.logger.log(`Driver ${driverId} successfully accepted ride ${rideId} via matchmaking service`);
        // Use the accepted details from the matchmaking service that includes 
        // full driver/vehicle/passenger info, estimated fare, rating, etc.
        const mmDetails = result.acceptedDetails;
        const acceptDetails: DriverAcceptDetails = {
          rideId: ride._id.toString(),
          rideUUId: ride.rideUUId,
          driver: {
            driverId: driverId,
            fullName: mmDetails?.driverName || driverUser?.fullName || 'Driver',
            phone: driverUser?.phone || '',
            profileImage: mmDetails?.driverImage || null,
            rating: mmDetails?.rating || 0,
          },
          vehicle: {
            vehicleId: vehicle?._id?.toString() || '',
            vehicleModel: mmDetails?.vehicleModel || vehicle?.vehicleModel || '',
            vehicleType: mmDetails?.vehicleType || vehicle?.vehicleType || '',
            color: mmDetails?.color || vehicle?.color || '',
            numberPlate: mmDetails?.numberPlate || vehicle?.numberPlate || '',
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
          estimatedFare: mmDetails?.estimatedFare || ride.estimatedFare || 0,
          estimatedTimeInMinutes: mmDetails?.estimatedTimeInMinutes || ride.estimatedTimeInMinutes || 0,
          distanceInKm: mmDetails?.distanceInKm || ride.distanceInKm || 0,
          acceptedAt: new Date().toISOString(),
        };
        return { success: true, message: result.message, data: acceptDetails };
      } else {
        this.logger.warn(`Matchmaking service returned: ${result?.message}`);
        return { success: false, message: result?.message || 'Failed to accept ride via matchmaking service' };
      }
    } catch (error: any) {
      this.logger.log(`error ${JSON.stringify(error)}`)
      this.logger.error(`Failed to call matchmaking service for accept: ${error?.message || error}`);
      return { success: false, message: 'Failed to communicate with matchmaking service' };
    }
  }

  /**
   * Driver rejects a ride.
   * Calls the matchmaking service GraphQL endpoint which handles notifications and continues matchmaking.
   */
  async rejectRide(rideId: string, driverId: string): Promise<DriverRideResponse> {
    this.logger.log(`Driver ${driverId} rejected ride ${rideId}`);

    const ride = await this.ridesRepository.findById(toMongoId(rideId));
    if (!ride) {
      return { success: false, message: 'Ride not found' };
    }

    // Call matchmaking service via GraphQL
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
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
      );

      const result = response.data?.data?.driverRespondToRide;
      if (result?.success) {
        this.logger.log(`Driver ${driverId} successfully accepted ride ${rideId} via matchmaking service`);
        // Build and return full ride details
        const acceptDetails = await this.buildAcceptDetails(ride, driverId);
        return { success: true, message: result.message, data: acceptDetails };
      } else {
        return { success: false, message: result?.message || 'Failed to reject ride via matchmaking service' };
      }
    } catch (error: any) {
      this.logger.log(`error ${JSON.stringify(error)}`)
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
        rating: driverDetails?.rating || 0, // placeholder — fetch from ratings collection in production
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

    // Call matchmaking service which handles all validation, fare calculation,
    // DB update, and event publishing
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
                mutation CompleteRide($rideId: String!, $driverId: String!) {
                  completeRide(rideId: $rideId, driverId: $driverId) {
                    rideId
                    rideUUId
                    rideStatus
                    totalDurationInMinutes
                    totalDuration
                    completedAt
                    fareBreakdown{
                    baseFare
                    distanceCharge
                    discount
                    totalFare
                    }
                  }
                }
              `,
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
      console.log(err)
      this.logger.error(`Failed to complete ride via matchmaking service: ${err?.message || err}`);
      // ErrorException is a function that throws HttpException, not a class.
      // If the error is already an HttpException (from ErrorException), re-throw it.
      if (err?.response || err?.status) {
        throw err;
      }
      throw ErrorException(null, "Failed to call the matchmaking service", 500);
    }
  }

}