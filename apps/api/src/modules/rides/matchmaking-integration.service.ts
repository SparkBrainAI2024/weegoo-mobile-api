import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { EnvService } from '@libs/common/config/env.service';
import { RideLocationInput, TriggerMatchmakingResult, UpdateLocationResult } from '@libs/data-access';

@Injectable()
export class MatchmakingIntegrationService {
  private readonly logger = new Logger(MatchmakingIntegrationService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly envService: EnvService,
  ) { }

  /**
   * Create an instant ride, trigger matchmaking, and if matchmaking fails,
   * delete the created ride. If successful, keep the ride saved.
   */
  async triggerInstantMatchmaking(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    vehicleType: string,
  ): Promise<TriggerMatchmakingResult> {
    // Step 1: Find a vehicle matching the requested type and the user's vehicles
    // (in production, this would be selected from available fleet; for now find any)
    const vehicle = await this.vehicleModel.findOne({ vehicleType: vehicleType as any, deleted: false }).exec();

    // Step 2: Create the ride in PENDING status
    const rideData: Partial<RidesDocument> = {
      rideType: RideTypes.INSTANT,
      bookingTime: new Date(),
      rideStatus: RideStatus.PENDING,
      passengerId: new Types.ObjectId(userId),
      vehicleId: vehicle?._id || new Types.ObjectId(),
      pickupLocation: {
        type: 'Point',
        coordinates: [pickupLocation.longitude, pickupLocation.latitude],
        address: pickupLocation.address,
        city: pickupLocation.city,
        province: pickupLocation.province,
        district: pickupLocation.district,
        fullAddress: pickupLocation.fullAddress,
      } as any,
      dropoffLocation: {
        type: 'Point',
        coordinates: [dropoffLocation.longitude, dropoffLocation.latitude],
        address: dropoffLocation.address,
        city: dropoffLocation.city,
        province: dropoffLocation.province,
        district: dropoffLocation.district,
        fullAddress: dropoffLocation.fullAddress,
      } as any,
      noOfPassengers: 1,
      deleted: false,
    };

    let ride: RidesDocument;
    try {
      ride = await this.ridesModel.create(rideData);
      this.logger.log(`Ride created with ID: ${ride._id} (${ride.rideUUId})`);
    } catch (err: any) {
      this.logger.error(`Failed to create ride: ${err.message}`);
      return { success: false, matched: false, rideId: '', rideUUId: '', message: 'Failed to create ride' };
    }

    // Step 3: Call matchmaking service
    const matchmakingUrl = this.getMatchmakingUrl();
    try {
      this.logger.log(`Calling matchmaking for ride ${ride._id}`);

      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation MatchDrivers($input: MatchDriversInput!) {
              matchDrivers(input: $input) {
                matched
                rideId
                rideUUId
                driverId
                driverName
                driverImage
                rating
                attempts { attemptNumber radiusKm driversFound driversRequested driverAccepted timeoutExpired }
                message
              }
            }
          `,
          variables: { input: { rideId: ride._id.toString() } },
        },
        { timeout: 120000 },
      );

      const result = response.data?.data?.matchDrivers;

      if (result?.matched) {
        this.logger.log(`Matchmaking succeeded for ride ${ride.rideUUId}: driver ${result.driverId}`);
        return {
          success: true,
          matched: true,
          rideId: ride._id.toString(),
          rideUUId: ride.rideUUId,
          message: `Driver ${result.driverName || result.driverId} matched`,
          driverId: result.driverId,
          driverName: result.driverName,
          attempts: result.attempts,
        };
      }

      // Step 4a: Matchmaking did not find a driver — delete the ride
      this.logger.warn(`Matchmaking failed for ride ${ride.rideUUId}: ${result?.message}. Deleting ride.`);
      await this.ridesModel.findByIdAndDelete(ride._id).exec();
      return {
        success: false,
        matched: false,
        rideId: '',
        rideUUId: '',
        message: result?.message || 'No driver found',
      };
    } catch (error: any) {
      // Step 4b: Matchmaking service call failed — delete the ride
      this.logger.error(`Matchmaking request failed for ride ${ride.rideUUId}: ${error?.message || error}. Deleting ride.`);
      await this.ridesModel.findByIdAndDelete(ride._id).exec();
      return {
        success: false,
        matched: false,
        rideId: '',
        rideUUId: '',
        message: 'Matchmaking service unavailable',
      };
    }
  }

  /**
   * Trigger matchmaking for a SCHEDULED ride.
   */
  async triggerScheduledMatchmaking(rideId: string): Promise<TriggerMatchmakingResult> {
    const matchmakingUrl = this.getMatchmakingUrl();

    try {
      this.logger.log(`Triggering scheduled matchmaking for ride: ${rideId}`);

      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation MatchScheduledDrivers($input: MatchScheduledDriversInput!) {
              matchScheduledDrivers(input: $input) {
                matched
                rideId
                rideUUId
                driverId
                driverName
                attempts { attemptNumber radiusKm driversFound driversRequested driverAccepted timeoutExpired }
                message
              }
            }
          `,
          variables: { input: { rideId } },
        },
        { timeout: 120000 },
      );

      const result = response.data?.data?.matchScheduledDrivers;
      if (result?.matched) {
        return {
          success: true, matched: true, rideId, rideUUId: result.rideUUId,
          message: `Driver ${result.driverName || result.driverId} matched for scheduled ride`,
          driverId: result.driverId, driverName: result.driverName, attempts: result.attempts,
        };
      }

      return { success: false, matched: false, rideId, rideUUId: result?.rideUUId || '', message: result?.message || 'No driver found' };
    } catch (error: any) {
      this.logger.error(`Scheduled matchmaking request failed: ${error?.message || error}`);
      return { success: false, matched: false, rideId, rideUUId: '', message: 'Matchmaking service unavailable' };
    }
  }

  /**
   * Create a scheduled ride with full details, then trigger scheduled matchmaking.
   */
  async createAndMatchScheduledRide(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    vehicleType: string,
    bookingTime: Date,
    noOfPassengers: number = 1,
  ): Promise<TriggerMatchmakingResult> {
    // Find a matching vehicle
    const vehicle = await this.vehicleModel.findOne({
      vehicleType: vehicleType as any,
      deleted: false,
    }).exec();

    // Create the ride in PENDING status
    const rideData: Partial<RidesDocument> = {
      rideType: RideTypes.SCHEDULED,
      bookingTime,
      rideStatus: RideStatus.PENDING,
      passengerId: new Types.ObjectId(userId),
      vehicleId: vehicle?._id || new Types.ObjectId(),
      pickupLocation: {
        type: 'Point',
        coordinates: [pickupLocation.longitude, pickupLocation.latitude],
        address: pickupLocation.address,
        city: pickupLocation.city,
        province: pickupLocation.province,
        district: pickupLocation.district,
        fullAddress: pickupLocation.fullAddress,
      } as any,
      dropoffLocation: {
        type: 'Point',
        coordinates: [dropoffLocation.longitude, dropoffLocation.latitude],
        address: dropoffLocation.address,
        city: dropoffLocation.city,
        province: dropoffLocation.province,
        district: dropoffLocation.district,
        fullAddress: dropoffLocation.fullAddress,
      } as any,
      noOfPassengers,
      deleted: false,
    };

    let ride: RidesDocument;
    try {
      ride = await this.ridesModel.create(rideData);
      this.logger.log(`Scheduled ride created with ID: ${ride._id} (${ride.rideUUId})`);
    } catch (err: any) {
      this.logger.error(`Failed to create scheduled ride: ${err.message}`);
      return { success: false, matched: false, rideId: '', rideUUId: '', message: 'Failed to create ride' };
    }

    // Call matchmaking service for scheduled ride
    const matchmakingUrl = this.getMatchmakingUrl();
    try {
      this.logger.log(`Calling scheduled matchmaking for ride ${ride._id}`);

      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation MatchScheduledDrivers($input: MatchScheduledDriversInput!) {
              matchScheduledDrivers(input: $input) {
                matched
                rideId
                rideUUId
                driverId
                driverName
                attempts { attemptNumber radiusKm driversFound driversRequested driverAccepted timeoutExpired }
                message
              }
            }
          `,
          variables: { input: { rideId: ride._id.toString() } },
        },
        { timeout: 120000 },
      );

      const result = response.data?.data?.matchScheduledDrivers;

      if (result?.matched) {
        this.logger.log(`Scheduled matchmaking succeeded for ride ${ride.rideUUId}: driver ${result.driverId}`);
        return {
          success: true,
          matched: true,
          rideId: ride._id.toString(),
          rideUUId: ride.rideUUId,
          message: `Driver ${result.driverName || result.driverId} matched for scheduled ride`,
          driverId: result.driverId,
          driverName: result.driverName,
          attempts: result.attempts,
        };
      }

      // Matchmaking did not find a driver — keep the ride for later cancellation/polling
      this.logger.warn(`Scheduled matchmaking failed for ride ${ride.rideUUId}: ${result?.message}`);
      return {
        success: false,
        matched: false,
        rideId: ride._id.toString(),
        rideUUId: ride.rideUUId,
        message: result?.message || 'No driver found for scheduled ride',
      };
    } catch (error: any) {
      this.logger.error(`Scheduled matchmaking request failed for ride ${ride.rideUUId}: ${error?.message || error}`);
      return {
        success: false,
        matched: false,
        rideId: ride._id.toString(),
        rideUUId: ride.rideUUId,
        message: 'Matchmaking service unavailable',
      };
    }
  }

    /**
   * Update passenger location via the ride-matchmaking service.
   * This will publish the location to the passenger location channel and update
   * distanceToReachPassenger/estimatedTimeToReachPassenger in the ride schema.
   */
  async updatePassengerLocation(passengerId: string, latitude: number, longitude: number): Promise<UpdateLocationResult> {
    const matchmakingUrl = this.getMatchmakingUrl();
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation UpdatePassengerLocation($input: UpdatePassengerLocationInput!) {
              updatePassengerLocation(input: $input) {
                success
                message
                latitude
                longitude
                updatedAt
              }
            }
          `,
          variables: { input: { passengerId, latitude, longitude } },
        },
        { timeout: 15000 },
      );

      const result = response.data?.data?.updatePassengerLocation;
      return result || { success: false, message: 'No response from matchmaking service', latitude, longitude, updatedAt: new Date().toISOString() };
    } catch (error: any) {
      this.logger.error(`Failed to update passenger location: ${error?.message || error}`);
      return { success: false, message: 'Matchmaking service unavailable', latitude, longitude, updatedAt: new Date().toISOString() };
    }
  }

  private getMatchmakingUrl(): string {
    return this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000/graphql');
  }
}
