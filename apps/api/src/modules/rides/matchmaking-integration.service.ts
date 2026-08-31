import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import axios from 'axios';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { EnvService } from '@libs/common/config/env.service';
import { RideLocationInput, RideSchedule, TriggerMatchmakingResult, UpdateLocationResult, VehicleEstimateGraphQL } from '@libs/data-access';
import { UserDetailsService } from '@libs/services/user';

@Injectable()
export class MatchmakingIntegrationService {
  private readonly logger = new Logger(MatchmakingIntegrationService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly envService: EnvService,
    private readonly userDetailsService: UserDetailsService,
  ) { }

  // ─── Shared GraphQL Queries ──────────────────────────────────────────────

  private get CANCEL_INSTANT_RIDE_QUERY(): string {
    return `mutation CancelInstantRide($rideId: String!, $passengerId: String!) {
      cancelInstantRide(rideId: $rideId, passengerId: $passengerId) {
        success message
      }
    }`;
  }

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
        matched rideId rideUUId passengerId rideStatus
        message
        ablyChannelId
        availableDrivers {
          driverId driverName driverImage driverEmail phone rating amount
          vehicleName vehicleType vehicleModel isAcType vehicleModelType color numberPlate
          estimatedFare
          availability {
            day date vehicleType amount isAvailableForBookings availableSeats remainingSeats timeSlots matchesTimeSlot
            pickupLocation { address latitude longitude }
            dropOffLocation { address latitude longitude }
          }
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
      schedule: this.buildScheduleInfo(rideType, bookingTime, noOfPassengers),
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

  /**
   * Builds the schedule sub-document for a SCHEDULED ride booking.
   * INSTANT rides return null (schedule info is only meaningful for bookings).
   */
  private buildScheduleInfo(
    rideType: RideTypes,
    bookingTime: Date,
    noOfPassengers: number,
  ): RideSchedule | null {
    if (rideType !== RideTypes.SCHEDULED) return null;
    const utcStart = new Date(bookingTime);
    utcStart.setUTCHours(0, 0, 0, 0);
    // Day-of-week name derived in Nepal wall-clock time (UTC+5:45, no DST).
    const nepalWall = new Date(bookingTime.getTime() + 345 * 60000);
    const day = [
      'SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY',
      'THURSDAY', 'FRIDAY', 'SATURDAY',
    ][nepalWall.getUTCDay()];
    return {
      bookingType: 'SCHEDULED',
      bookingTime,
      bookingDate: utcStart,
      day,
      noOfPassengers: noOfPassengers || 1,
      isFlexible: false,
      pickupBufferTimeMinutes: 0,
      timeSlots: [],
      availabilityDayId: null,
    };
  }

  private async callMatchmakingGraphql(query: string, variables: Record<string, any>, timeout: number = 60000): Promise<any> {
    const matchmakingUrl = this.getMatchmakingUrl();
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        { query, variables },
        timeout?{ timeout: timeout }:{},
      );

      this.logger.log('B. After axios',JSON.stringify(response.data));
      return response.data?.data;
    } catch (error: any) {
      // Surface the actual GraphQL error body (validation errors, etc.) so a
      // bare "status code 400" log is never all we have to debug with.
      const responseErrors = error?.response?.data?.errors;
      if (responseErrors) {
        this.logger.error(`Matchmaking GraphQL errors: ${JSON.stringify(responseErrors)}`);
      }
      throw error;
    }
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  async triggerInstantMatchmaking(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    vehicleType: string,
    noOfPassengers: number = 1,
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
      vehicle?._id || new Types.ObjectId(), new Date(), noOfPassengers,
    );

    let ride: RidesDocument;
    try {
      ride = await this.ridesModel.create(rideData);
      this.logger.log(`Ride created with ID: ${ride._id} (${ride.rideUUId})`);
    } catch (err: any) {
      this.logger.error(`Failed to create ride: ${err.message}`);
      return { success: false, matched: false, rideId: '', rideUUId: '', message: 'Failed to create ride' };
    }

    // Silently save recent places in the background
    this.saveRecentPlacesSilently(userId, pickupLocation, dropoffLocation);

    try {
      const data = await this.callMatchmakingGraphql(
        this.MATCH_INSTANT_QUERY,
        { input: { rideId: ride._id.toString() } },600000);
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

      // Matchmaking did not find a match - verify ride status before deleting
      this.logger.warn(`Matchmaking returned no match for ride ${ride.rideUUId}. Verifying ride status.`);
      const rideAfterMatchmaking = await this.ridesModel.findById(ride._id);
      if (!rideAfterMatchmaking) {
        this.logger.warn(`Ride ${ride.rideUUId} was deleted/cancelled during matchmaking (likely by cancelInstantRide). Returning cancelled signal.`);
        return {
          ...baseResponse,
          success: false,
          matched: false,
          rideId: '',
          rideUUId: '',
          message: 'Ride was cancelled by user',
        };
      }
      if (rideAfterMatchmaking && rideAfterMatchmaking.rideStatus === RideStatus.CONFIRMED) {
        // Ride was already confirmed by matchmaking despite response indicating no match
        this.logger.log(`Ride ${ride.rideUUId} was already confirmed despite matchmaking returning no match. Preserving ride.`);
        return {
          success: true,
          matched: true,
          rideId: rideAfterMatchmaking._id.toString(),
          rideUUId: rideAfterMatchmaking.rideUUId || ride.rideUUId,
          message: 'Driver matched successfully',
          driverId: rideAfterMatchmaking.driverId?.toString() || undefined,
          rideType: RideTypes.INSTANT,
          rideStatus: RideStatus.CONFIRMED,
          ablyChannelId: rideAfterMatchmaking.ablyChannelId || ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
          driverLocationChannel: `WG-DRIVER-${rideAfterMatchmaking.driverId?.toString() || ''}-driver-location`,
          pickupLocation: ride.pickupLocation ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city } : undefined,
          dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
          noOfPassengers: ride.noOfPassengers || 1,
        } as any;
      }

      // Ride is still pending - safe to delete
      this.logger.warn(`Matchmaking failed for ride ${ride.rideUUId}. Deleting ride.`);
      await this.deleteAbandonedRide(ride);
      return {
        ...baseResponse,
        rideId: '',
        rideUUId: '',
      };
    } catch (error: any) {
      this.logger.error(`Matchmaking request failed for ride ${ride.rideUUId}${ride._id} post-matchmaking verification: ${error?.message || error}. Verifying ride status.`);

      const rideAfterMatchmaking = await this.ridesModel.findById(ride._id).exec();
      if (!rideAfterMatchmaking) {
        this.logger.warn(`Ride ${ride.rideUUId} was deleted after matchmaking response. Returning no match.`);
        return { success: false, matched: false, rideId: '', rideUUId: '', message: error?.message || 'Ride was cancelled by user' };
      }
      if (rideAfterMatchmaking && rideAfterMatchmaking.rideStatus === RideStatus.CONFIRMED) {
        // Ride was confirmed by matchmaking despite the request timeout/error
        this.logger.log(`Ride ${ride.rideUUId} was already confirmed despite matchmaking error. Preserving ride.`);
        return {
          success: true,
          matched: true,
          rideId: rideAfterMatchmaking._id.toString(),
          rideUUId: rideAfterMatchmaking.rideUUId || ride.rideUUId,
          message: 'Driver matched successfully',
          driverId: rideAfterMatchmaking.driverId?.toString() || undefined,
          rideType: RideTypes.INSTANT,
          rideStatus: RideStatus.CONFIRMED,
          ablyChannelId: rideAfterMatchmaking.ablyChannelId || ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
          driverLocationChannel: `WG-DRIVER-${rideAfterMatchmaking.driverId?.toString() || ''}-driver-location`,
          pickupLocation: ride.pickupLocation ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city } : undefined,
          dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
          noOfPassengers: ride.noOfPassengers || 1,
        } as any;
      }

      // Ride is still pending - safe to delete
      this.logger.error(`Matchmaking request failed for ride ${ride.rideUUId}: ${error?.message || error}. Deleting ride.`);
      await this.deleteAbandonedRide(ride);
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
   * Maps a raw matchScheduledDrivers result (ScheduledMatchResultGraphQL shape)
   * into the normalized TriggerMatchmakingResult consumed by the passenger
   * resolvers — mirroring the mapping done for instant matchmaking.
   */
  private normalizeScheduledResult(
    result: any,
    ride?: RidesDocument | null,
  ): TriggerMatchmakingResult {
    const baseResponse = {
      success: !!result?.matched,
      matched: result?.matched || false,
      rideId: result?.rideId || (ride?._id ? ride._id.toString() : ''),
      rideUUId: result?.rideUUId || ride?.rideUUId || '',
      passengerId: result?.passengerId || (ride?.passengerId ? ride.passengerId.toString() : undefined),
      rideType: RideTypes.SCHEDULED,
      rideStatus: result?.rideStatus || RideStatus.PENDING,
      message: result?.message || 'No driver found',
      ablyChannelId:
        result?.ablyChannelId || (result?.rideUUId ? `WG-RIDE-${result.rideUUId}-ride-details` : undefined),
      pickupLocation: ride?.pickupLocation
        ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city }
        : undefined,
      dropoffLocation: ride?.dropoffLocation
        ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city }
        : undefined,
      noOfPassengers: ride?.noOfPassengers || 1,
      availableDrivers: result?.availableDrivers || [],
    } as any;

    return baseResponse;
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

      if (result?.matched) {
        this.logger.log(`Scheduled matchmaking succeeded for ride ${rideId}: driver ${result.driverId}`);
        return this.normalizeScheduledResult(result);
      }

      return {
        success: false,
        matched: false,
        rideId: result?.rideId || rideId,
        rideUUId: result?.rideUUId || '',
        passengerId: result?.passengerId || undefined,
        message: result?.message || 'No driver found',
        rideType: RideTypes.SCHEDULED,
        rideStatus: result?.rideStatus || RideStatus.PENDING,
        attempts: this.normalizeAttempts(result?.attempts, 120),
        ablyChannelId: result?.ablyChannelId || (result?.rideUUId ? `WG-RIDE-${result.rideUUId}-ride-details` : undefined),
        availableDrivers: result?.availableDrivers || [],
      };
    } catch (error: any) {
      this.logger.error(`Scheduled matchmaking request failed: ${error?.message || error}`);
      return { success: false, matched: false, rideId, rideUUId: '', message: 'Matchmaking service unavailable' };
    }
  }

  async createAndMatchScheduledRide(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
    bookingTime: Date,
    noOfPassengers: number = 1,
  ): Promise<TriggerMatchmakingResult> {
    const rideData = this.buildRideDocument(
      RideTypes.SCHEDULED, userId, pickupLocation, dropoffLocation,
      new Types.ObjectId(), bookingTime, noOfPassengers,
    );

    let ride: RidesDocument;
    try {
      ride = await this.ridesModel.create(rideData);
      this.logger.log(`Scheduled ride created with ID: ${ride._id} (${ride.rideUUId})`);
    } catch (err: any) {
      this.logger.error(`Failed to create scheduled ride: ${err.message}`);
      return { success: false, matched: false, rideId: '', rideUUId: '', message: 'Failed to create ride' };
    }

    // Silently save recent places in the background

    try {
      const data = await this.callMatchmakingGraphql(
        this.MATCH_SCHEDULED_QUERY,
        { input: { rideId: ride._id.toString() } },
        120000,
      );
      const result = data?.matchScheduledDrivers;

      // Persist the ride document after the matchmaking mutation so the ride
      // reflects the matched driver / returned status.
      if (result?.driverId) {
        ride.driverId = new Types.ObjectId(result.driverId);
      }
      if (result?.rideStatus) {
        ride.rideStatus = result.rideStatus;
      }
      await ride.save();
      this.logger.log(`Scheduled ride ${ride.rideUUId} saved after matchmaking (matched: ${!!result?.matched}).`);

      if (result?.matched) {
        this.logger.log(`Scheduled booking succeeded for ride ${ride.rideUUId}: ${(result?.availableDrivers || []).length} available option(s)`);
        return this.normalizeScheduledResult(result, ride);
      }

      // No driver matched: remove the scheduled ride so no orphan PENDING
      // booking lingers. deleteAbandonedRide re-verifies the status first so a
      // ride that was confirmed during matchmaking is never removed.
      this.logger.warn(`No available scheduled drivers right now for ride ${ride.rideUUId}: ${result?.message}. Removing the scheduled ride.`);
      await this.deleteAbandonedRide(ride);
      return {
        ...this.normalizeScheduledResult(result, ride),
        success: true,
        matched: false,
        rideId: '',
        rideUUId: '',
        message: result?.message || 'No available scheduled drivers right now.',
        rideStatus: RideStatus.PENDING,
      };
    } catch (error: any) {
      this.logger.error(`Scheduled matchmaking request failed for ride ${ride.rideUUId}: ${error?.message || error}`);
      return {
        success: false,
        matched: false,
        rideId: ride._id.toString(),
        rideUUId: ride.rideUUId,
        rideType: RideTypes.SCHEDULED,
        message: 'Matchmaking service unavailable',
      };
    }
  }

  async getVehicleEstimates(
    pickup: RideLocationInput,
    dropoff: RideLocationInput,
    noOfPassengers: number,
    promoCodeId?: string,
    passengerId?: string,
  ): Promise<VehicleEstimateGraphQL[]> {
    try {
      this.logger.log(`Fetching vehicle estimates for route from ${pickup.address} to ${dropoff.address}`);

      const data = await this.callMatchmakingGraphql(
        `query GetVehicleEstimates($pickup: RideLocationInput!, $dropoff: RideLocationInput!, $noOfPassengers: Int!, $promoCodeId: ID, $passengerId: String) {
          getVehicleEstimates(pickupLocation: $pickup, dropoffLocation: $dropoff, noOfPassengers: $noOfPassengers, promoCodeId: $promoCodeId, passengerId: $passengerId) {
            vehicleType estimatedFare originalFare discountAmount promoCodeName promoCodeId promoCodeMessage distanceKm driverDistanceToPickupKm estimatedTimeInMinutes comfortType hasAC noOfPassengers
          }
        }`,
        { pickup, dropoff, noOfPassengers, promoCodeId: promoCodeId || null, passengerId: passengerId || null },
      );

      return data?.getVehicleEstimates || [];
    } catch (error: any) {
      this.logger.error(`Failed to get vehicle estimates: ${error?.message || error}${error.response ? `, response: ${JSON.stringify(error.response)}` : ''}`);
      return [];
    }
  }

  async cancelInstantRide(passengerId: string): Promise<{ success: boolean; message: string }> {
    try {
      const ride = await this.ridesModel.findOne({
        passengerId: new Types.ObjectId(passengerId),
        rideType: RideTypes.INSTANT,
        rideStatus: { $in: [RideStatus.PENDING, RideStatus.CONFIRMED] }
      }).exec();

      if (!ride) {
        this.logger.warn(`No active instant ride found for passenger ${passengerId} during cancellation - ride may have already been cancelled or deleted.`);
        return { success: true, message: 'No active ride to cancel' };
      }

      this.logger.log(`Cancelling instant ride ${ride._id} (${ride.rideUUId}) for passenger ${passengerId}`);

      const data = await this.callMatchmakingGraphql(
        this.CANCEL_INSTANT_RIDE_QUERY,
        { rideId: ride._id.toString(), passengerId }
      );

      const result = data?.cancelInstantRide;
      if (!result) {
        this.logger.error(`Failed to cancel instant ride ${ride._id}: No response from matchmaking service`);
        return { success: false, message: 'Matchmaking service unavailable' };
      }

      this.logger.log(`Instant ride ${ride._id} cancelled successfully: ${result.message}`);
      return { success: result.success, message: result.message };
    } catch (error: any) {
      this.logger.error(`Failed to cancel instant ride ${error?.message || error}`);
      return { success: false, message: 'Failed to cancel ride' };
    }
  }

  /**
   * Safely deletes an abandoned ride left over from a failed/unsuccesful
   * matchmaking attempt. Re-verifies the ride status immediately before
   * deletion so a ride that was confirmed (or progressed) by the matchmaking
   * service is never removed, and retries once if the delete fails so a
   * transient DB error never leaves a lingering PENDING ride.
   */
  private async deleteAbandonedRide(ride: RidesDocument): Promise<void> {
    const rideId = ride._id;
    try {
      const fresh = await this.ridesModel.findById(rideId).exec();
      if (!fresh) {
        this.logger.log(`Ride ${ride.rideUUId} no longer exists - nothing to clean up.`);
        return;
      }
      // Only terminal/unmatched states are safe to remove.
      const deletableStatuses = [RideStatus.PENDING, RideStatus.CANCELLED];
      if (!deletableStatuses.includes(fresh.rideStatus)) {
        this.logger.warn(`Ride ${ride.rideUUId} progressed to ${fresh.rideStatus} during matchmaking - preserving ride.`);
        return;
      }
      try {
        await this.ridesModel.findByIdAndDelete(rideId);
        this.logger.log(`Abandoned ride ${ride.rideUUId} (${rideId}) deleted after failed matchmaking.`);
      } catch (deleteErr: any) {
        // One retry to guarantee cleanup on transient DB failures
        this.logger.error(`First delete attempt failed for ride ${ride.rideUUId}: ${deleteErr?.message || deleteErr}. Retrying.`);
        await this.ridesModel.findByIdAndDelete(rideId);
        this.logger.log(`Abandoned ride ${ride.rideUUId} (${rideId}) deleted on retry.`);
      }
    } catch (cleanupErr: any) {
      // Never let cleanup failure mask the matchmaking result
      this.logger.error(`Failed to clean up abandoned ride ${ride.rideUUId} (${rideId}): ${cleanupErr?.message || cleanupErr}`);
    }
  }

  private saveRecentPlacesSilently(
    userId: string,
    pickupLocation: RideLocationInput,
    dropoffLocation: RideLocationInput,
  ): void {
    this.userDetailsService
      .saveRecentPlace(
        userId,
        {
          address: pickupLocation.address,
          latitude: pickupLocation.latitude,
          longitude: pickupLocation.longitude,
        },
        {
          address: dropoffLocation.address,
          latitude: dropoffLocation.latitude,
          longitude: dropoffLocation.longitude,
        },
      )
      .catch((err: any) => {
        this.logger.warn(`Failed to save recent places for user ${userId}: ${err?.message || err}`);
      });
  }

  private getMatchmakingUrl(): string {
    return this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004');
  }
}
