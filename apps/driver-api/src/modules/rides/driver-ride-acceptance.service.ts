import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { User, UserDocument } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { AblyRideListenerService, AblyService } from '@libs/services/ably';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';

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
export class DriverRideAcceptanceService implements OnModuleInit {
  private readonly logger = new Logger(DriverRideAcceptanceService.name);
  private driverId: string;

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly ablyListenerService: AblyRideListenerService,
    private readonly ablyService: AblyService,
    private readonly envService: EnvService,
  ) {}

  onModuleInit() {
    this.logger.log('Driver ride acceptance service initialized. Awaiting driver authentication.');
  }

  /**
   * Subscribe a specific driver to ride requests.
   * Called when a driver comes online.
   */
  async subscribeForDriver(driverId: string): Promise<void> {
    this.driverId = driverId;

    this.ablyListenerService.subscribeToDriverRideRequests(
      driverId,
      (rideRequest) => {
        this.logger.log(
          `Driver ${driverId}: Received ride request for ride ${rideRequest.rideUUId} (${rideRequest.distanceInKm}km, $${rideRequest.estimatedFare})`,
        );
      },
      (rideTaken) => {
        this.logger.log(`Driver ${driverId}: Ride ${rideTaken.rideId} was taken by another driver`);
      },
    );

    this.ablyListenerService.subscribeToDriverScheduledRequests(driverId, (rideRequest) => {
      this.logger.log(`Driver ${driverId}: Received scheduled ride request for ride ${rideRequest.rideUUId}`);
    });

    this.logger.log(`Driver ${driverId} subscribed to ride requests`);
  }

  /**
   * Driver accepts a ride.
   * Locks the ride atomically, then publishes full driver+vehicle+passenger details.
   */
  async acceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string; data?: DriverAcceptDetails }> {
    this.logger.log(`Driver ${driverId} attempting to accept ride ${rideId}`);

    // Atomic lock: only update if still PENDING
    const updatedRide = await this.ridesModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(rideId),
        rideStatus: RideStatus.PENDING,
      },
      {
        $set: {
          driverId: new Types.ObjectId(driverId),
          rideStatus: RideStatus.CONFIRMED,
        },
      },
      { new: true },
    ).exec();

    if (!updatedRide) {
      this.logger.warn(`Driver ${driverId}: Ride ${rideId} was already locked by another driver`);
      return { success: false, message: 'Ride was already accepted by another driver' };
    }

    this.logger.log(`Driver ${driverId} successfully locked ride ${rideId}`);

    // Fetch full driver details with vehicle info
    const acceptDetails = await this.buildAcceptDetails(updatedRide, driverId);

    // Publish full details to passenger channel
    await this.ablyService.publish(`ride:${rideId}:passenger`, 'driver-accepted', acceptDetails);

    // Notify matchmaking service via its listener channel
    await this.ablyService.publish(`WG-RIDE-${updatedRide.rideUUId}:driver-response`, 'driver-response', {
      driverId,
      action: 'accept',
    });

    // Also notify the ride request channel so all subscribers get driver info
    await this.ablyService.publish(`WG-RIDE-${updatedRide.rideUUId}-ride-request`, 'driver-accepted', {
      ...acceptDetails,
      acceptedAt: new Date().toISOString(),
    });

    // Notify all other drivers that the ride is taken
    await this.ablyService.publish(`ride:${rideId}:drivers`, 'ride-taken', {
      rideId,
      rideUUId: updatedRide.rideUUId,
      message: 'This ride has been accepted by another driver',
    });
    await this.ablyService.publish(`WG-RIDE-${updatedRide.rideUUId}-ride-request`, 'ride-taken', {
      rideId,
      rideUUId: updatedRide.rideUUId,
      message: 'This ride has been accepted by another driver',
    });

    return { success: true, message: 'Ride accepted successfully', data: acceptDetails };
  }

  /**
   * Driver rejects a ride.
   */
  async rejectRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} rejected ride ${rideId}`);

    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();

    // Notify matchmaking service via its listener channel
    await this.ablyService.publish(
      `WG-RIDE-${ride.rideUUId}:driver-response`,
      'driver-response',
      {
        driverId,
        action: 'reject',
      },
    );

    return { success: true, message: 'Ride rejected' };
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
        profileImage: driverDetails?.profileImage || undefined,
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

  async getMatchmakingResult(rideId: string): Promise<any> {
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            query GetMatchStatus($input: EstimatedFareInput!) {
              estimatedFare(input: $input) { total }
            }
          `,
          variables: { input: { rideId } },
        },
        { timeout: 5000 },
      );
      return response.data?.data;
    } catch (error: any) {
      this.logger.warn(`Failed to get matchmaking result: ${error?.message || error}`);
      return null;
    }
  }
}