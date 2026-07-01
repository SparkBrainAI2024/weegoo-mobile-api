import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { EnvService } from '@libs/common/config/env.service';
import { RideLocationInput, TriggerMatchmakingResult, UpdateLocationResult, VehicleEstimateGraphQL } from '@libs/data-access';

@Injectable()
export class MatchmakingIntegrationService {
  private readonly logger = new Logger(MatchmakingIntegrationService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly envService: EnvService,
  ) { }

  // ─── Shared GraphQL Queries ──────────────────────────────────────────────

  private get MATCH_INSTANT_QUERY(): string {
    return `mutation MatchDrivers($input: MatchDriversInput!) {
      matchDrivers(input: $input) {
        matched rideId rideUUId passengerId driverId driverName driverImage rating
        estimatedFare { pickupCost distanceCost durationCost total }
        attempts { attemptNumber radiusKm waitTimeSeconds driversFound driversRequested driverAccepted acceptedDriverId timeoutExpired status }
        message ablyChannelId
        acceptedDetails {
          rideId rideUUId driverId driverName driverImage rating phone
          vehicleType vehicleModel color numberPlate
          pickupLocation { address coordinates city }
          dropoffLocation { address coordinates city }
          estimatedFare estimatedTimeInMinutes distanceInKm acceptedAt ablyChannelId
        }
      }
    }`;
  }

  private get MATCH_SCHEDULED_QUERY(): string {
    return `mutation MatchScheduledDrivers($input: MatchScheduledDriversInput!) {
      matchScheduledDrivers(input: $input) {
        matched rideId rideUUId driverId driverName
        attempts { attemptNumber radiusKm waitTimeSeconds driversFound driversRequested driverAccepted acceptedDriverId timeoutExpired status }
        message
        acceptedDetails {
          rideId rideUUId driverId driverName phone profileImage rating
          vehicleId vehicleModel vehicleType color numberPlate year
          passengerId
          pickupLocation { address coordinates city }
          dropoffLocation { address coordinates city }
          estimatedFare estimatedTimeInMinutes distanceInKm acceptedAt
        }
      }
    }`;
  }

  // ─── Shared Helpers ──────────────────────────────────────────────────────

  private normalizeAttempts(attempts: any[], defaultWaitSeconds: number = 20): any[] {
    if (!attempts) return [];
    return attempts.map((a: any) => ({
      attemptNumber: a.attemptNumber ?? 0,
      radiusKm: a.radiusKm ?? 0,
      waitTimeSeconds: a.waitTimeSeconds ?? defaultWaitSeconds,
      driversFound: a.driversFound ?? 0,
      driversRequested: a.driversRequested ?? 0,
      driverAccepted: a.driverAccepted ?? false,
      acceptedDriverId: a.acceptedDriverId,
      timeoutExpired: a.timeoutExpired ?? false,
      status: a.status ?? 'unknown',
    }));
  }

  private buildRideDocument(
    rideType: RideTypes,
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    vehicleId: Types.ObjectId,
    bookingTime: Date,
    noOfPassengers: number = 1,
  ): Partial<RidesDocument> {
    return {
      rideType,
      bookingTime,
      rideStatus: RideStatus.PENDING,
      passengerId: new Types.ObjectId(userId),
      vehicleId: vehicleId || new Types.ObjectId(),
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
  }

  private async callMatchmakingGraphql(query: string, variables: Record<string, any>, timeout: number = 60000): Promise<any> {
    const matchmakingUrl = this.getMatchmakingUrl();
    const response = await axios.post(
      `${matchmakingUrl}/graphql`,
      { query, variables },
      { timeout },
    );
    return response.data?.data;
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async triggerInstantMatchmaking(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    vehicleType: string,
  ): Promise<TriggerMatchmakingResult> {
    const activeRide = await this.ridesModel.findOne({
      passengerId: new Types.ObjectId(userId),
      rideType: RideTypes.INSTANT,
      rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
      deleted: false,
    }).exec();

    if (activeRide) {
      this.logger.warn(`Passenger ${userId} already has an active ride ${activeRide.rideUUId}. Rejecting new instant ride request.`);
      return {
        success: false,
        matched: true,
        rideId: activeRide._id.toString(),
        rideUUId: activeRide.rideUUId,
        message: 'Please complete your current ride before requesting a new ride.',
        driverId: activeRide.driverId?.toString() || undefined,
        rideType: RideTypes.INSTANT,
        rideStatus: activeRide.rideStatus,
      } as any;
    }

    const vehicle = await this.vehicleModel.findOne({ vehicleType: vehicleType as any, deleted: false }).exec();

    const rideData = this.buildRideDocument(
      RideTypes.INSTANT, userId, pickupLocation, dropoffLocation,
      vehicle?._id || new Types.ObjectId(), new Date(), 1,
    );

    let ride: RidesDocument;
    try {
      ride = await this.ridesModel.create(rideData);
      this.logger.log(`Ride created with ID: ${ride._id} (${ride.rideUUId})`);
    } catch (err: any) {
      this.logger.error(`Failed to create ride: ${err.message}`);
      return { success: false, matched: false, rideId: '', rideUUId: '', message: 'Failed to create ride' };
    }

    try {
      const data = await this.callMatchmakingGraphql(
        this.MATCH_INSTANT_QUERY,
        { input: { rideId: ride._id.toString() } },
      );
      const result = data?.matchDrivers;

      const baseResponse = {
        success: !!result?.matched,
        matched: result?.matched || false,
        rideId: result?.rideId || ride._id.toString(),
        rideUUId: result?.rideUUId || ride.rideUUId || '',
        message: result?.message || 'No driver found',
        driverId: result?.driverId || undefined,
        driverName: result?.driverName || undefined,
        driverImage: result?.driverImage || undefined,
        rating: result?.rating || undefined,
        rideType: RideTypes.INSTANT,
        rideStatus: result?.matched ? RideStatus.CONFIRMED : RideStatus.PENDING,
        attempts: this.normalizeAttempts(result?.attempts),
        ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
        driverLocationChannel: `WG-DRIVER-${result?.driverId || ''}-driver-location`,
        pickupLocation: ride.pickupLocation ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city } : undefined,
        dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
        estimatedFare: result?.estimatedFare ? { pickupCost: result.estimatedFare.pickupCost, distanceCost: result.estimatedFare.distanceCost, durationCost: result.estimatedFare.durationCost, total: result.estimatedFare.total } : undefined,
        estimatedFareTotal: result?.estimatedFare?.total || undefined,
        estimatedTimeInMinutes: ride.estimatedTimeInMinutes || undefined,
        distanceInKm: ride.distanceInKm || undefined,
        noOfPassengers: ride.noOfPassengers || 1,
      } as any;

      if (result?.matched) {
        this.logger.log(`Matchmaking succeeded for ride ${ride.rideUUId}: driver ${result.driverId}`);
        return {
          ...baseResponse,
          acceptedDetails: result.acceptedDetails ? {
            rideId: result.acceptedDetails.rideId,
            rideUUId: result.acceptedDetails.rideUUId,
            driver: {
              driverId: result.acceptedDetails.driverId || '',
              fullName: result.acceptedDetails.driverName || '',
              phone: result.acceptedDetails.phone || '',
              profileImage: result.acceptedDetails.driverImage || null,
              rating: result.acceptedDetails.rating || 0,
            },
            vehicle: {
              vehicleId: result.acceptedDetails.vehicleId || '',
              vehicleModel: result.acceptedDetails.vehicleModel || '',
              vehicleType: result.acceptedDetails.vehicleType || '',
              color: result.acceptedDetails.color || '',
              numberPlate: result.acceptedDetails.numberPlate || '',
            },
            pickupLocation: result.acceptedDetails.pickupLocation,
            dropoffLocation: result.acceptedDetails.dropoffLocation,
            estimatedFare: result.acceptedDetails.estimatedFare,
            estimatedTimeInMinutes: result.acceptedDetails.estimatedTimeInMinutes,
            distanceInKm: result.acceptedDetails.distanceInKm,
            acceptedAt: result.acceptedDetails.acceptedAt,
            ablyChannelId: baseResponse.ablyChannelId,
            driverLocationChannel: baseResponse.driverLocationChannel,
          } : undefined,
        };
      }

      // Matchmaking failed - delete the ride
      this.logger.warn(`Matchmaking failed for ride ${ride.rideUUId}. Deleting ride.`);
      await this.ridesModel.findByIdAndDelete(ride._id).exec();
      return {
        ...baseResponse,
        rideId: '',
        rideUUId: '',
      };
    } catch (error: any) {
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

  async triggerScheduledMatchmaking(rideId: string): Promise<TriggerMatchmakingResult> {
    try {
      this.logger.log(`Triggering scheduled matchmaking for ride: ${rideId}`);

      const data = await this.callMatchmakingGraphql(
        this.MATCH_SCHEDULED_QUERY,
        { input: { rideId } },
        120000,
      );
      const result = data?.matchScheduledDrivers;

      const baseResponse = {
        success: !!result?.matched,
        matched: result?.matched || false,
        rideId: result?.rideId || rideId,
        rideUUId: result?.rideUUId || '',
        message: result?.message || 'No driver found',
        driverId: result?.driverId || undefined,
        driverName: result?.driverName || undefined,
        attempts: this.normalizeAttempts(result?.attempts, 120),
        ablyChannelId: `WG-RIDE-${result?.rideUUId || ''}-ride-details`,
        driverLocationChannel: `WG-DRIVER-${result?.driverId || ''}-driver-location`,
      } as any;

      if (result?.matched) {
        this.logger.log(`Scheduled matchmaking succeeded for ride ${rideId}: driver ${result.driverId}`);
        return { ...baseResponse, acceptedDetails: result.acceptedDetails };
      }

      return { ...baseResponse };
    } catch (error: any) {
      this.logger.error(`Scheduled matchmaking request failed: ${error?.message || error}`);
      return { success: false, matched: false, rideId, rideUUId: '', message: 'Matchmaking service unavailable' };
    }
  }

  async createAndMatchScheduledRide(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    vehicleType: string,
    bookingTime: Date,
    noOfPassengers: number = 1,
  ): Promise<TriggerMatchmakingResult> {
    const vehicle = await this.vehicleModel.findOne({
      vehicleType: vehicleType as any,
      deleted: false,
    }).exec();

    const rideData = this.buildRideDocument(
      RideTypes.SCHEDULED, userId, pickupLocation, dropoffLocation,
      vehicle?._id || new Types.ObjectId(), bookingTime, noOfPassengers,
    );

    let ride: RidesDocument;
    try {
      ride = await this.ridesModel.create(rideData);
      this.logger.log(`Scheduled ride created with ID: ${ride._id} (${ride.rideUUId})`);
    } catch (err: any) {
      this.logger.error(`Failed to create scheduled ride: ${err.message}`);
      return { success: false, matched: false, rideId: '', rideUUId: '', message: 'Failed to create ride' };
    }

    try {
      const data = await this.callMatchmakingGraphql(
        this.MATCH_SCHEDULED_QUERY,
        { input: { rideId: ride._id.toString() } },
        120000,
      );
      const result = data?.matchScheduledDrivers;

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
          attempts: this.normalizeAttempts(result?.attempts, 120),
          acceptedDetails: result.acceptedDetails,
        };
      }

      // Keep ride for later cancellation/polling
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

  async getVehicleEstimates(
    pickup: RideLocationInput,
    dropoff: RideLocationInput,
    noOfPassengers: number,
  ): Promise<VehicleEstimateGraphQL[]> {
    try {
      this.logger.log(`Fetching vehicle estimates for route from ${pickup.address} to ${dropoff.address}`);

      const data = await this.callMatchmakingGraphql(
        `query GetVehicleEstimates($pickup: RideLocationInput!, $dropoff: RideLocationInput!, $noOfPassengers: Int!) {
          getVehicleEstimates(pickupLocation: $pickup, dropoffLocation: $dropoff, noOfPassengers: $noOfPassengers) {
            vehicleType estimatedFare distanceKm estimatedTimeInMinutes comfortType hasAC noOfPassengers
          }
        }`,
        { pickup, dropoff, noOfPassengers },
        15000,
      );

      return data?.getVehicleEstimates || [];
    } catch (error: any) {
      this.logger.error(`Failed to get vehicle estimates: ${error?.message || error}`);
      return [];
    }
  }

  private getMatchmakingUrl(): string {
    return this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000/graphql');
  }
}