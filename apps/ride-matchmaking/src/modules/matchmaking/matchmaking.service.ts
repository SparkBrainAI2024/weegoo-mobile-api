import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { User, UserDocument } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { VehicleType } from '@libs/data-access/enums/vehicle.enum';
import { roles, DriverOnlineStatus, ridePreference } from '@libs/data-access/enums/user.enum';
import { AblyService } from '@libs/services/ably';
import {
  MATCHMAKING_CONFIG,
  MatchResult,
  MatchAttemptResult,
  DriverScore,
  FareBreakdown,
  WeatherCondition,
  TrafficCondition,
  RainCondition,
  HistoricalTraffic,
  ScheduledFareBreakdown,
} from './config/matchmaking.config';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly ablyService: AblyService,
    private readonly distanceCalculator: DistanceCalculatorService,
    private readonly pricingService: DynamicPricingService,
  ) {}

  // ════════════════════════════════════════════════════════════════
  //  INSTANT Ride Matchmaking
  // ════════════════════════════════════════════════════════════════

  async matchDrivers(params: {
    rideId: string;
    weather?: WeatherCondition;
    traffic?: TrafficCondition;
  }): Promise<MatchResult> {
    const { rideId, weather, traffic } = params;
    const ride = await this.ridesModel
      .findById(new Types.ObjectId(rideId))
      .populate('vehicleId')
      .exec();

    if (!ride) {
      return { matched: false, rideId, rideUUId: '', passengerId: '', attempts: [], message: 'Ride not found' };
    }

    if (ride.rideStatus !== RideStatus.PENDING) {
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: `Ride is not in PENDING status. Current: ${ride.rideStatus}` };
    }

    if (ride.rideType !== RideTypes.INSTANT) {
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Use matchScheduledDrivers for SCHEDULED rides.' };
    }

    return this.executeExpandingRingMatch(ride, { weather, traffic });
  }

  // ════════════════════════════════════════════════════════════════
  //  SCHEDULED Ride Matchmaking
  // ════════════════════════════════════════════════════════════════

  async matchScheduledDrivers(params: {
    rideId: string;
    rain?: RainCondition;
    historicalTraffic?: HistoricalTraffic;
  }): Promise<{
    matched: boolean;
    rideId: string;
    rideUUId: string;
    passengerId: string;
    driverId?: string;
    driverName?: string;
    estimatedFare?: ScheduledFareBreakdown;
    attempts: MatchAttemptResult[];
    message: string;
  }> {
    const { rideId, rain, historicalTraffic } = params;
    const ride = await this.ridesModel
      .findById(new Types.ObjectId(rideId))
      .populate('vehicleId')
      .exec();

    if (!ride) {
      return { matched: false, rideId, rideUUId: '', passengerId: '', attempts: [], message: 'Ride not found' };
    }

    if (ride.rideStatus !== RideStatus.PENDING) {
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: `Ride is not in PENDING status. Current: ${ride.rideStatus}` };
    }

    if (ride.rideType !== RideTypes.SCHEDULED) {
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Use matchDrivers for INSTANT rides.' };
    }

    const pickupCoords = ride.pickupLocation?.coordinates;
    if (!pickupCoords || pickupCoords.length < 2) {
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Ride has no pickup coordinates' };
    }

    const pickupLat = pickupCoords[1];
    const pickupLng = pickupCoords[0];

    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const requestedType = (vehicle?.vehicleType as string) || 'CAR';

    const dropoffCoords = ride.dropoffLocation?.coordinates;
    const dropoffLat = dropoffCoords?.[1];
    const dropoffLng = dropoffCoords?.[0];

    let routeDistanceKm = ride.distanceInKm || 0;
    let routeDurationMinutes = ride.estimatedTimeInMinutes || 0;

    if (dropoffLat && dropoffLng) {
      try {
        const route = await this.distanceCalculator.calculateDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch (err) {
        this.logger.warn(`Failed to calculate route for scheduled fare: ${err}`);
      }
    }

    const scheduledFare = this.pricingService.calculateScheduledFare({
      distanceKm: routeDistanceKm,
      durationMinutes: routeDurationMinutes,
      vehicleType: requestedType,
      rain,
      historicalTraffic,
    });

    const radii = MATCHMAKING_CONFIG.SCHEDULED_FALLBACK_RADII_KM;
    const attempts: MatchAttemptResult[] = [];
    let matched = false;
    let acceptedDriverId: string | undefined;
    let acceptedDriverName: string | undefined;

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = MATCHMAKING_CONFIG.SCHEDULED_ATTEMPT_WAIT_SECONDS;

      this.logger.log(`[SCHEDULED] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km radius`);

      const drivers = await this.findAvailableScheduledDrivers(
        pickupLat, pickupLng, radiusKm, requestedType, attemptIdx, ride.bookingTime,
      );

      if (drivers.length === 0) {
        attempts.push({
          attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds,
          driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false,
        });
        continue;
      }

      const scoredDrivers = this.scoreDrivers(drivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);

      for (const driver of requestBatch) {
        await this.ablyService.publish(`driver:${driver.driverId}:rides`, 'scheduled-ride-request', {
          rideId, rideUUId: ride.rideUUId, rideType: ride.rideType, bookingTime: ride.bookingTime,
          pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
          dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
          distanceInKm: routeDistanceKm, estimatedFare: scheduledFare.total, estimatedTimeInMinutes: routeDurationMinutes,
          passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
          expirySeconds: waitTimeSeconds, attemptNumber: attemptIdx + 1, isScheduled: true,
        });
      }

      const driverResponse = await this.waitForDriverResponse(rideId, requestBatch.map((d) => d.driverId), waitTimeSeconds * 1000);

      if (driverResponse.accepted) {
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        acceptedDriverName = requestBatch.find((d) => d.driverId === driverResponse.driverId)?.fullName || 'Driver';
        await this.ridesModel.findByIdAndUpdate(ride._id, { driverId: new Types.ObjectId(acceptedDriverId), rideStatus: RideStatus.CONFIRMED, isFavourite: 0 });

        // Fetch full driver + vehicle details for scheduled acceptance
        const acceptDetails = await this.buildScheduledAcceptDetails(ride, acceptedDriverId, scheduledFare);
        await this.ablyService.publish(`ride:${rideId}:passenger`, 'scheduled-driver-accepted', acceptDetails);
        await this.ablyService.publish(`ride:${rideId}:drivers`, 'ride-taken', { rideId, rideUUId: ride.rideUUId, message: 'This ride has been accepted by another driver' });
      }

      attempts.push({
        attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds,
        driversFound: scoredDrivers.length, driversRequested: requestBatch.length,
        driverAccepted: driverResponse.accepted, acceptedDriverId: driverResponse.driverId, timeoutExpired: !driverResponse.accepted,
      });
    }

    if (!matched) {
      const failMessage = 'No available drivers found within 15 km radius for your scheduled time. Please try a different time.';
      await this.ablyService.publish(`ride:${rideId}:passenger`, 'scheduled-match-failed', { rideId, rideUUId: ride.rideUUId, message: failMessage, suggestedAction: 'reschedule' });
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare: scheduledFare, attempts, message: failMessage };
    }

    return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, estimatedFare: scheduledFare, attempts, message: 'Scheduled driver matched successfully' };
  }

  // ════════════════════════════════════════════════════════════════
  //  Shared: Expanding Ring (used by INSTANT)
  // ════════════════════════════════════════════════════════════════

  private async executeExpandingRingMatch(
    ride: RidesDocument,
    params: { weather?: WeatherCondition; traffic?: TrafficCondition },
  ): Promise<MatchResult> {
    const { weather, traffic } = params;
    const rideId = ride._id.toString();
    const pickupCoords = ride.pickupLocation?.coordinates;
    const pickupLat = pickupCoords[1];
    const pickupLng = pickupCoords[0];

    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const requestedType = (vehicle?.vehicleType as string) || 'CAR';

    const dropoffCoords = ride.dropoffLocation?.coordinates;
    let routeDistanceKm = ride.distanceInKm || 0;
    let routeDurationMinutes = ride.estimatedTimeInMinutes || 0;

    if (dropoffCoords?.[1] && dropoffCoords?.[0]) {
      try {
        const route = await this.distanceCalculator.calculateDistance(pickupLat, pickupLng, dropoffCoords[1], dropoffCoords[0]);
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch {}
    }

    const estimatedFare = this.pricingService.calculateFare({
      distanceKm: routeDistanceKm, durationMinutes: routeDurationMinutes, vehicleType: requestedType, weather, traffic,
    });

    const radii = MATCHMAKING_CONFIG.FALLBACK_RADII_KM;
    const attempts: MatchAttemptResult[] = [];
    let matched = false;
    let acceptedDriverId: string | undefined;
    let acceptedDriverName: string | undefined;

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = attemptIdx === 0 ? MATCHMAKING_CONFIG.FIRST_ATTEMPT_WAIT_SECONDS : MATCHMAKING_CONFIG.SUBSEQUENT_ATTEMPT_WAIT_SECONDS;

      this.logger.log(`[INSTANT] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km`);
      const drivers = await this.findAvailableDrivers(pickupLat, pickupLng, radiusKm, requestedType, attemptIdx);

      if (drivers.length === 0) {
        attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false });
        continue;
      }

      const scoredDrivers = this.scoreDrivers(drivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);

      for (const driver of requestBatch) {
        await this.ablyService.publish(`driver:${driver.driverId}:rides`, 'ride-request', {
          rideId, rideUUId: ride.rideUUId, rideType: ride.rideType,
          pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
          dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
          distanceInKm: routeDistanceKm, estimatedFare: estimatedFare.total, estimatedTimeInMinutes: routeDurationMinutes,
          passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
          expirySeconds: waitTimeSeconds, attemptNumber: attemptIdx + 1, weather, traffic,
        });
      }

      const driverResponse = await this.waitForDriverResponse(rideId, requestBatch.map((d) => d.driverId), waitTimeSeconds * 1000);

      if (driverResponse.accepted) {
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        acceptedDriverName = requestBatch.find((d) => d.driverId === driverResponse.driverId)?.fullName || 'Driver';
        await this.ridesModel.findByIdAndUpdate(ride._id, { driverId: new Types.ObjectId(acceptedDriverId), rideStatus: RideStatus.CONFIRMED, isFavourite: 0 });

        // Fetch full driver + vehicle details for the acceptance payload
        const acceptDetails = await this.buildAcceptDetails(ride, acceptedDriverId, estimatedFare);
        await this.ablyService.publish(`ride:${rideId}:passenger`, 'driver-accepted', acceptDetails);
        await this.ablyService.publish(`ride:${rideId}:drivers`, 'ride-taken', { rideId, rideUUId: ride.rideUUId, message: 'This ride has been accepted by another driver' });
      }

      attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: scoredDrivers.length, driversRequested: requestBatch.length, driverAccepted: driverResponse.accepted, acceptedDriverId: driverResponse.driverId, timeoutExpired: !driverResponse.accepted });
    }

    if (!matched) {
      const failMessage = 'No available drivers found within 10 km radius. Please try scheduling your ride.';
      await this.ablyService.publish(`ride:${rideId}:passenger`, 'match-failed', { rideId, rideUUId: ride.rideUUId, message: failMessage, suggestedAction: 'schedule' });
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: failMessage };
    }

    return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, estimatedFare, attempts, message: 'Driver matched successfully' };
  }

  // ════════════════════════════════════════════════════════════════
  //  Driver filtering (INSTANT)
  //  Checks: role === RIDER, online status from UserDetails, live geoLocation
  // ════════════════════════════════════════════════════════════════

  private async findAvailableDrivers(
    pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number,
  ): Promise<DriverScore[]> {
    // 1. Find all vehicles of the requested type
    const vehicles = await this.vehicleModel
      .find({ vehicleType: vehicleType as VehicleType, deleted: false })
      .populate('driverId')
      .limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING)
      .exec();

    const drivers: DriverScore[] = [];

    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;

      // 2. Check User role: must be RIDER
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;

      // 3. Look up UserDetails for online status, live geoLocation, and ride preference
      const userDetails = await this.userDetailsModel.findOne({ userId: driver._id, deleted: false }).exec();

      // 4. Check online status: only include drivers who are ONLINE
      if (!userDetails || userDetails.driverOnlineStatus !== DriverOnlineStatus.ONLINE) continue;

      // 5. Check no active trip
      const activeRide = await this.ridesModel.findOne({
        driverId: driver._id,
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
        deleted: false,
      }).exec();
      if (activeRide) continue;

      // 6. Rating filter
      const minRating = attemptIndex < MATCHMAKING_CONFIG.BYPASS_RATING_AFTER_ATTEMPTS ? MATCHMAKING_CONFIG.MIN_ACCEPT_RATING : 0;
      const driverRating = 4.5; // In production, fetch from driver_ratings collection
      if (driverRating < minRating) continue;

      // 7. Use live geoLocation from UserDetails for accurate distance calculation
      let driverLat: number;
      let driverLng: number;

      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        // UserDetails stores coordinates as [lng, lat] (GeoJSON standard)
        driverLng = userDetails.geoLocation.coordinates[0];
        driverLat = userDetails.geoLocation.coordinates[1];
      } else {
        // Fallback: simulate location within the radius for drivers without GPS fix
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5);
        driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }

      // 8. Calculate distance from driver's live location to pickup
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng);

      // 9. Only include if within radius
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = await this.ridesModel.countDocuments({ driverId: driver._id, rideStatus: RideStatus.COMPLETED, deleted: false }).exec();
        drivers.push({
          driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '',
          vehicleId: v._id.toString(), vehicleModel: v.vehicleModel, vehicleType: v.vehicleType, color: v.color, numberPlate: v.numberPlate,
          distanceToPickupKm: distResult.distanceKm, rating: driverRating, completedTripsCount, score: 0, estimatedTimeToReachMinutes: distResult.durationMinutes,
        });
      }
    }

    return drivers;
  }

  // ════════════════════════════════════════════════════════════════
  //  Driver filtering (SCHEDULED)
  // ════════════════════════════════════════════════════════════════

  private async findAvailableScheduledDrivers(
    pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number, bookingTime: Date,
  ): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel
      .find({ vehicleType: vehicleType as VehicleType, deleted: false })
      .populate('driverId')
      .limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING)
      .exec();

    const drivers: DriverScore[] = [];

    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;

      // Role check
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;

      // Look up UserDetails for preference and status
      const userDetails = await this.userDetailsModel.findOne({ userId: driver._id, deleted: false }).exec();
      if (!userDetails) continue;

      // Ride preference must include SCHEDULED or BOTH
      if (userDetails.ridePreference !== ridePreference.SCHEDULED && userDetails.ridePreference !== ridePreference.BOTH) continue;

      // No conflicting trip at the scheduled time
      const conflictingRide = await this.ridesModel.findOne({
        driverId: driver._id,
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING] },
        bookingTime: {
          $gte: new Date(bookingTime.getTime() - 30 * 60 * 1000),
          $lte: new Date(bookingTime.getTime() + 30 * 60 * 1000),
        },
        deleted: false,
      }).exec();
      if (conflictingRide) continue;

      // Rating filter
      const minRating = attemptIndex < MATCHMAKING_CONFIG.BYPASS_RATING_AFTER_ATTEMPTS ? MATCHMAKING_CONFIG.MIN_ACCEPT_RATING : 0;
      const driverRating = 4.5;
      if (driverRating < minRating) continue;

      // Use live geoLocation for distance (or simulate fallback)
      let driverLat: number;
      let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLng = userDetails.geoLocation.coordinates[0];
        driverLat = userDetails.geoLocation.coordinates[1];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5);
        driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }

      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng);

      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = await this.ridesModel.countDocuments({ driverId: driver._id, rideStatus: RideStatus.COMPLETED, deleted: false }).exec();
        drivers.push({
          driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '',
          vehicleId: v._id.toString(), vehicleModel: v.vehicleModel, vehicleType: v.vehicleType, color: v.color, numberPlate: v.numberPlate,
          distanceToPickupKm: distResult.distanceKm, rating: driverRating, completedTripsCount, score: 0, estimatedTimeToReachMinutes: distResult.durationMinutes,
        });
      }
    }

    return drivers;
  }

  // ════════════════════════════════════════════════════════════════
  //  Scoring
  // ════════════════════════════════════════════════════════════════

  private scoreDrivers(drivers: DriverScore[]): DriverScore[] {
    const { DISTANCE_WEIGHT, RATING_WEIGHT, COMPLETED_TRIPS_WEIGHT } = MATCHMAKING_CONFIG.SCORING;
    const maxDistance = Math.max(...drivers.map((d) => d.distanceToPickupKm), 1);
    const maxRating = 5.0;
    const maxTrips = Math.max(...drivers.map((d) => d.completedTripsCount), 1);

    for (const driver of drivers) {
      driver.score =
        (driver.distanceToPickupKm / maxDistance) * DISTANCE_WEIGHT +
        (driver.rating / maxRating) * RATING_WEIGHT +
        (driver.completedTripsCount / maxTrips) * COMPLETED_TRIPS_WEIGHT;
      driver.score = Math.max(0, driver.score);
    }

    return drivers.sort((a, b) => a.score - b.score);
  }

  // ════════════════════════════════════════════════════════════════
  //  Driver response handling
  // ════════════════════════════════════════════════════════════════

  private async waitForDriverResponse(
    rideId: string, driverIds: string[], timeoutMs: number,
  ): Promise<{ accepted: boolean; driverId?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.log(`Driver response timeout for ride ${rideId} after ${timeoutMs}ms`);
        resolve({ accepted: false });
      }, timeoutMs);

      const unsubscribe = this.ablyService.subscribe(
        `ride:${rideId}:driver-response`, 'driver-response',
        (message) => {
          const response = message.data as { driverId: string; action: 'accept' | 'reject' };
          if (response.action === 'accept' && driverIds.includes(response.driverId)) {
            clearTimeout(timeout);
            unsubscribe();
            resolve({ accepted: true, driverId: response.driverId });
          }
        },
      );
    });
  }

  async handleDriverResponse(rideId: string, driverId: string, action: 'accept' | 'reject'): Promise<{ success: boolean; message: string }> {
    await this.ablyService.publish(`ride:${rideId}:driver-response`, 'driver-response', { driverId, action });
    if (action === 'reject') {
      this.logger.log(`Driver ${driverId} rejected ride ${rideId}`);
      return { success: true, message: 'Ride rejected' };
    }
    this.logger.log(`Driver ${driverId} accepted ride ${rideId}`);
    return { success: true, message: 'Ride accepted' };
  }

  // ════════════════════════════════════════════════════════════════
  //  Fare estimation
  // ════════════════════════════════════════════════════════════════

  async getEstimatedFare(rideId: string, weather?: WeatherCondition, traffic?: TrafficCondition): Promise<FareBreakdown | null> {
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
    if (!ride) return null;
    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const vehicleType = (vehicle?.vehicleType as string) || 'CAR';
    const pickupCoords = ride.pickupLocation?.coordinates;
    const dropoffCoords = ride.dropoffLocation?.coordinates;
    let distanceKm = ride.distanceInKm || 5;
    let durationMinutes = ride.estimatedTimeInMinutes || 15;
    if (pickupCoords && dropoffCoords && pickupCoords.length >= 2 && dropoffCoords.length >= 2) {
      try {
        const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0]);
        distanceKm = route.distanceKm;
        durationMinutes = route.durationMinutes;
      } catch {}
    }
    return this.pricingService.calculateFare({ distanceKm, durationMinutes, vehicleType, weather, traffic });
  }

  /**
   * Update a driver's current geo-location in UserDetails.
   * This is used for real-time proximity matching.
   * Stores coordinates as [longitude, latitude] per GeoJSON standard.
   */
  async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<{ success: boolean; message: string }> {
    const driverObjectId = new Types.ObjectId(driverId);

    const updated = await this.userDetailsModel.findOneAndUpdate(
      { userId: driverObjectId, deleted: false },
      {
        $set: {
          geoLocation: {
            type: 'Point',
            coordinates: [longitude, latitude],
          },
        },
      },
      { new: true },
    ).exec();

    if (!updated) {
      this.logger.warn(`Driver ${driverId} not found in UserDetails. Cannot update location.`);
      return { success: false, message: 'Driver details not found' };
    }

    this.logger.log(`Driver ${driverId} location updated: [${latitude}, ${longitude}]`);
    return { success: true, message: 'Location updated successfully' };
  }

  async getScheduledEstimatedFare(rideId: string, rain?: RainCondition, historicalTraffic?: HistoricalTraffic): Promise<ScheduledFareBreakdown | null> {
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
    if (!ride) return null;
    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const vehicleType = (vehicle?.vehicleType as string) || 'CAR';
    const pickupCoords = ride.pickupLocation?.coordinates;
    const dropoffCoords = ride.dropoffLocation?.coordinates;
    let distanceKm = ride.distanceInKm || 5;
    let durationMinutes = ride.estimatedTimeInMinutes || 15;
    if (pickupCoords && dropoffCoords && pickupCoords.length >= 2 && dropoffCoords.length >= 2) {
      try {
        const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0]);
        distanceKm = route.distanceKm;
        durationMinutes = route.durationMinutes;
      } catch {}
    }
    return this.pricingService.calculateScheduledFare({ distanceKm, durationMinutes, vehicleType, rain, historicalTraffic });
  }

  // ════════════════════════════════════════════════════════════════
  //  Build acceptance details payloads
  // ════════════════════════════════════════════════════════════════

  private async buildAcceptDetails(
    ride: RidesDocument,
    driverId: string,
    estimatedFare: FareBreakdown,
  ): Promise<any> {
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();

    return {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      driver: {
        driverId,
        fullName: driverUser?.fullName || 'Driver',
        phone: driverUser?.phone || '',
        profileImage: driverDetails?.profileImage || undefined,
        rating: 4.5,
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
        fullName: '', // passenger name not fetched here; could be added
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
      estimatedFare: estimatedFare?.total || 0,
      estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
      distanceInKm: ride.distanceInKm || 0,
      acceptedAt: new Date().toISOString(),
    };
  }

  private async buildScheduledAcceptDetails(
    ride: RidesDocument,
    driverId: string,
    estimatedFare: ScheduledFareBreakdown,
  ): Promise<any> {
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();

    return {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      driver: {
        driverId,
        fullName: driverUser?.fullName || 'Driver',
        phone: driverUser?.phone || '',
        profileImage: driverDetails?.profileImage || undefined,
        rating: 4.5,
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
        fullName: '',
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
      estimatedFare: estimatedFare?.total || 0,
      estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
      distanceInKm: ride.distanceInKm || 0,
      bookingTime: ride.bookingTime,
      acceptedAt: new Date().toISOString(),
    };
  }
}
