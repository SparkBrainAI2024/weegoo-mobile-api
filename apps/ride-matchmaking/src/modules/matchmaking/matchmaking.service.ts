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
import { NotificationType } from '@libs/data-access/enums/notification.enum';
import { CreateNotificationInput } from '@libs/data-access/dtos/input/create-notification.input';
import { AblyService, RideChannelService } from '@libs/services/ably';
import { NotificationService } from '@libs/services/notification';
import {
  MatchResult,
  MatchAttemptResult,
  DriverScore,
  FareBreakdown,
  RainCondition,
  HistoricalTraffic,
  ScheduledFareBreakdown,
  VehicleEstimateGraphQL,
} from 'libs/data-access';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';
import { MATCHMAKING_CONFIG } from '@libs/common';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';
import { S3Service } from '@libs/s3';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly ablyService: AblyService,
    private readonly rideChannelService: RideChannelService,
    private readonly distanceCalculator: DistanceCalculatorService,
    private readonly pricingService: DynamicPricingService,
    private readonly notificationService: NotificationService,
    private readonly s3: S3Service,
  ) {}

  // ════════════════════════════════════════════════════════════════
  //  INSTANT Ride Matchmaking
  // ════════════════════════════════════════════════════════════════

  async matchDrivers(params: { rideId: string }): Promise<MatchResult> {
    const { rideId } = params;
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).populate('vehicleId').exec();
    if (!ride) return { matched: false, rideId, rideUUId: '', passengerId: '', attempts: [], message: 'Ride not found' };
    if (ride.rideStatus !== RideStatus.PENDING) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: `Ride is not in PENDING status. Current: ${ride.rideStatus}` };
    if (ride.rideType !== RideTypes.INSTANT) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Use matchScheduledDrivers for SCHEDULED rides.' };
    const result = await this.executeExpandingRingMatch(ride);
    return { ...result, ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details` };
  }

  // ════════════════════════════════════════════════════════════════
  //  SCHEDULED Ride Matchmaking
  // ════════════════════════════════════════════════════════════════

  async matchScheduledDrivers(params: {
    rideId: string;
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
    ablyChannelId?: string;
  }> {
    const { rideId } = params;
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).populate('vehicleId').exec();
    if (!ride) return { matched: false, rideId, rideUUId: '', passengerId: '', attempts: [], message: 'Ride not found' };
    if (ride.rideStatus !== RideStatus.PENDING) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: `Ride is not in PENDING status. Current: ${ride.rideStatus}` };
    if (ride.rideType !== RideTypes.SCHEDULED) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Use matchDrivers for INSTANT rides.' };

    const pickupCoords = ride.pickupLocation?.coordinates;
    if (!pickupCoords || pickupCoords.length < 2) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Ride has no pickup coordinates' };

    const pickupLat = pickupCoords[1];
    const pickupLng = pickupCoords[0];
    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const requestedType = (vehicle?.vehicleType as string) || 'CAR';
    const dropoffCoords = ride.dropoffLocation?.coordinates;
    let routeDistanceKm = ride.distanceInKm || 0;
    let routeDurationMinutes = ride.estimatedTimeInMinutes || 0;

    if (dropoffCoords?.[1] && dropoffCoords?.[0]) {
      try {
        const route = await this.distanceCalculator.calculateDistance(pickupLat, pickupLng, dropoffCoords[1], dropoffCoords[0],requestedType);
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch (err) {
        this.logger.warn(`Failed to calculate route for scheduled fare: ${err}`);
      }
    }

    const scheduledFare = this.pricingService.calculateScheduledFare({ distanceKm: routeDistanceKm, durationMinutes: routeDurationMinutes, vehicleType: requestedType });
    const radii = MATCHMAKING_CONFIG.SCHEDULED_FALLBACK_RADII_KM;
    const attempts: MatchAttemptResult[] = [];
    let matched = false;
    let acceptedDriverId: string | undefined;
    let acceptedDriverName: string | undefined;

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = MATCHMAKING_CONFIG.SCHEDULED_ATTEMPT_WAIT_SECONDS;
      this.logger.log(`[SCHEDULED] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km radius`);

      const drivers = await this.findAvailableScheduledDrivers(pickupLat, pickupLng, radiusKm, requestedType, attemptIdx, ride.bookingTime);

      if (drivers.length === 0) {
        attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false, status: 'no_drivers_found' });
        continue;
      }

      const scoredDrivers = this.scoreDrivers(drivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);

      for (const driver of requestBatch) {
        await this.rideChannelService.publishMatchmakingRideRequest(ride.rideUUId, {
          rideId, rideType: ride.rideType, bookingTime: ride.bookingTime?.toISOString(),
          pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
          dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
          distanceInKm: routeDistanceKm, estimatedFare: scheduledFare.total, estimatedTimeInMinutes: routeDurationMinutes,
          passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
          expirySeconds: waitTimeSeconds, attemptNumber: attemptIdx + 1, isScheduled: true,
          driverImage: driver.profileImage || null, rating: driver.rating,
          driverId: driver.driverId, driverName: driver.fullName,
        });
      }

      const driverResponse = await this.waitForDriverResponse(rideId, requestBatch.map((d) => d.driverId), waitTimeSeconds * 1000);

      if (driverResponse.accepted) {
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        acceptedDriverName = requestBatch.find((d) => d.driverId === driverResponse.driverId)?.fullName || 'Driver';
        await this.ridesModel.findByIdAndUpdate(ride._id, { driverId: new Types.ObjectId(acceptedDriverId), rideStatus: RideStatus.CONFIRMED, isFavourite: 0 });
        const acceptDetails = await this.buildScheduledAcceptDetails(ride, acceptedDriverId, scheduledFare);
        await this.rideChannelService.publishDriverAccepted(ride.rideUUId, acceptDetails);
      }

      attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: scoredDrivers.length, driversRequested: requestBatch.length, driverAccepted: driverResponse.accepted, acceptedDriverId: driverResponse.driverId, timeoutExpired: !driverResponse.accepted, status: driverResponse.accepted ? 'accepted' : 'timeout' });
    }

    if (!matched) {
      const failMessage = 'No available drivers found within 15 km radius for your scheduled time. Please try a different time.';
      await this.rideChannelService.publishMatchFailed(ride.rideUUId, rideId, failMessage, 'reschedule');
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare: scheduledFare, attempts, message: failMessage };
    }

    return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, estimatedFare: scheduledFare, attempts, message: 'Scheduled driver matched successfully', ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details` };
  }

  // ════════════════════════════════════════════════════════════════
  //  Shared: Expanding Ring (used by INSTANT)
  // ════════════════════════════════════════════════════════════════

  private async executeExpandingRingMatch(ride: RidesDocument): Promise<MatchResult> {
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
        const route = await this.distanceCalculator.calculateDistance(pickupLat, pickupLng, dropoffCoords[1], dropoffCoords[0],requestedType.toLowerCase());
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch {}
    }
    this.logger.log(`Calculated route for ride ${ride.rideUUId}: distance ${routeDistanceKm} km, duration ${routeDurationMinutes} minutes`);
    const estimatedFare = this.pricingService.calculateFare({ distanceKm: routeDistanceKm, durationMinutes: routeDurationMinutes });
    const radii = MATCHMAKING_CONFIG.FALLBACK_RADII_KM;
    const attempts: MatchAttemptResult[] = [];
    let matched = false;
    let acceptedDriverId: string | undefined;
    let acceptedDriverName: string | undefined;
    let acceptedDriverImage: string | undefined;
    let acceptedRating: number | undefined;
    const DRIVER_RESPONSE_TIMEOUT_SECONDS = 20;

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = DRIVER_RESPONSE_TIMEOUT_SECONDS;
      this.logger.log(`[INSTANT] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km`);
      const drivers = await this.findAvailableDrivers(pickupLat, pickupLng, radiusKm, requestedType, attemptIdx);

      if (drivers.length === 0) {
        attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false, status: 'no_drivers_found' });
        continue;
      }

      const scoredDrivers = this.scoreDrivers(drivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);

      for (const driver of requestBatch) {
        await this.rideChannelService.publishMatchmakingRideRequest(ride.rideUUId, {
          rideId, rideType: ride.rideType,
          pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
          dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
          distanceInKm: routeDistanceKm, estimatedFare: estimatedFare.total, estimatedTimeInMinutes: routeDurationMinutes,
          passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
          expirySeconds: waitTimeSeconds, attemptNumber: attemptIdx + 1,
          driverImage: driver.profileImage || null, rating: driver.rating,
          driverId: driver.driverId, driverName: driver.fullName,
        });

        try {
          const driverUser = await this.userModel.findById(new Types.ObjectId(driver.driverId)).exec();
          if (driverUser) {
            const notificationInput: CreateNotificationInput = { title: 'New Ride Request', notificationType: NotificationType.RIDE_REQUEST, description: `You have a new ride request from pickup ${ride.pickupLocation?.address || 'your area'}` };
            await this.notificationService.createNotification(notificationInput, driverUser);
          }
        } catch (err) {
          this.logger.warn(`Failed to send ride request notification to driver ${driver.driverId}: ${err}`);
        }
      }

      const driverResponse = await this.waitForDriverResponse(rideId, requestBatch.map((d) => d.driverId), waitTimeSeconds * 1000);

      if (driverResponse.accepted) {
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        const acceptedDriver = requestBatch.find((d) => d.driverId === driverResponse.driverId);
        acceptedDriverName = acceptedDriver?.fullName || 'Driver';
        acceptedDriverImage = acceptedDriver?.profileImage;
        acceptedRating = acceptedDriver?.rating;
        await this.ridesModel.findByIdAndUpdate(ride._id, { driverId: new Types.ObjectId(acceptedDriverId), rideStatus: RideStatus.CONFIRMED, isFavourite: 0 });

        const acceptDetails = await this.buildAcceptDetails(ride, acceptedDriverId, estimatedFare);
        await this.rideChannelService.publishDriverAccepted(ride.rideUUId, acceptDetails);
        await this.rideChannelService.publishRideTaken(ride.rideUUId, rideId);
      }

      attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: scoredDrivers.length, driversRequested: requestBatch.length, driverAccepted: driverResponse.accepted, acceptedDriverId: driverResponse.driverId, timeoutExpired: !driverResponse.accepted, status: driverResponse.accepted ? 'accepted' : 'timeout' });
    }

    if (!matched) {
      const failMessage = 'No available drivers found within 10 km radius. Please try scheduling your ride.';
      await this.rideChannelService.publishMatchFailed(ride.rideUUId, rideId, failMessage, 'schedule');
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: failMessage };
    }

    return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, driverImage: acceptedDriverImage, rating: acceptedRating, estimatedFare, attempts, message: 'Driver matched successfully' };
  }

  // ════════════════════════════════════════════════════════════════
  //  Driver filtering (INSTANT)
  // ════════════════════════════════════════════════════════════════

  private async findAvailableDrivers(pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel.find({ vehicleType: vehicleType as VehicleType, deleted: false }).populate('driverId').limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING).exec();
    const drivers: DriverScore[] = [];
    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;
      const userDetails = await this.userDetailsModel.findOne({ userId: driver._id, deleted: false }).exec();
      if (!userDetails || userDetails.driverOnlineStatus !== DriverOnlineStatus.ONLINE) continue;
      const activeRide = await this.ridesModel.findOne({ driverId: driver._id, rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] }, deleted: false }).exec();
      if (activeRide) continue;
      const minRating = attemptIndex < MATCHMAKING_CONFIG.BYPASS_RATING_AFTER_ATTEMPTS ? MATCHMAKING_CONFIG.MIN_ACCEPT_RATING : 0;
      const driverRating = userDetails.rating ?? 0;
      if (driverRating < minRating) continue;
      let driverLat: number;
      let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLng = userDetails.geoLocation.coordinates[0];
        driverLat = userDetails.geoLocation.coordinates[1];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5);
        driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng, vehicleType.toLowerCase());
      this.logger.log(`Searching drivers ${distResult.distanceKm} distance`);
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = await this.ridesModel.countDocuments({ driverId: driver._id, rideStatus: RideStatus.COMPLETED, deleted: false }).exec();
        drivers.push({
          driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '',
          profileImage: getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)),
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

  private async findAvailableScheduledDrivers(pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number, bookingTime: Date): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel.find({ vehicleType: vehicleType as VehicleType, deleted: false }).populate('driverId').limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING).exec();
    const drivers: DriverScore[] = [];
    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;
      const userDetails = await this.userDetailsModel.findOne({ userId: driver._id, deleted: false }).exec();
      if (!userDetails) continue;
      if (userDetails.ridePreference !== ridePreference.SCHEDULED && userDetails.ridePreference !== ridePreference.BOTH) continue;
      const conflictingRide = await this.ridesModel.findOne({ driverId: driver._id, rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING] }, bookingTime: { $gte: new Date(bookingTime.getTime() - 30 * 60 * 1000), $lte: new Date(bookingTime.getTime() + 30 * 60 * 1000) }, deleted: false }).exec();
      if (conflictingRide) continue;
      const minRating = attemptIndex < MATCHMAKING_CONFIG.BYPASS_RATING_AFTER_ATTEMPTS ? MATCHMAKING_CONFIG.MIN_ACCEPT_RATING : 0;
      const driverRating = userDetails.rating ?? 0;
      if (driverRating < minRating) continue;
      let driverLat: number;
      let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLng = userDetails.geoLocation.coordinates[0];
        driverLat = userDetails.geoLocation.coordinates[1];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5);
        driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng, vehicleType.toLowerCase());
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = await this.ridesModel.countDocuments({ driverId: driver._id, rideStatus: RideStatus.COMPLETED, deleted: false }).exec();
        drivers.push({
          driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '',
          profileImage: getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)),
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
      driver.score = (driver.distanceToPickupKm / maxDistance) * DISTANCE_WEIGHT + (driver.rating / maxRating) * RATING_WEIGHT + (driver.completedTripsCount / maxTrips) * COMPLETED_TRIPS_WEIGHT;
      driver.score = Math.max(0, driver.score);
    }
    return drivers.sort((a, b) => a.score - b.score);
  }

  // ════════════════════════════════════════════════════════════════
  //  Driver response handling
  // ════════════════════════════════════════════════════════════════

  private async waitForDriverResponse(rideUUID: string, driverIds: string[], timeoutMs: number): Promise<{ accepted: boolean; driverId?: string }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        this.logger.log(`Driver response timeout for ride ${rideUUID} after ${timeoutMs}ms`);
        resolve({ accepted: false });
      }, timeoutMs);

      const channelName = `WG-RIDE-${rideUUID}-ride-details`;
      const unsubscribe = this.ablyService.subscribe(
        channelName, 'ride-detail',
        (message) => {
          const response = message.data as { eventType?: string; driverId: string; action: 'accept' | 'reject' };
          if (response.eventType === 'driver-response' && response.action === 'accept' && driverIds.includes(response.driverId)) {
            clearTimeout(timeout);
            unsubscribe();
            resolve({ accepted: true, driverId: response.driverId });
          }
        },
      );
    });
  }

  async handleDriverResponse(rideUUID: string, driverId: string, action: 'accept' | 'reject'): Promise<{ success: boolean; message: string; acceptedDetails?: any }> {
    await this.rideChannelService.publishRideEvent(rideUUID, 'driver-response', { driverId, action });
    try {
      const ride = await this.ridesModel.findOne({ rideUUId: rideUUID }).exec();
      if (!ride) return { success: false, message: 'Ride not found' };
      const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
      const driverName = driverUser?.fullName ?? null;
      const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId), deleted: false }).exec();
      if (action === 'accept') {
        const updatedRide = await this.ridesModel.findOneAndUpdate({ _id: ride._id, rideStatus: RideStatus.PENDING }, { $set: { driverId: new Types.ObjectId(driverId), rideStatus: RideStatus.CONFIRMED } }, { new: true }).exec();
        if (!updatedRide) return { success: false, message: 'Ride was already accepted by another driver' };
        let acceptDetails: any;
        if (ride.rideType === RideTypes.SCHEDULED) {
          const fare = await this.getScheduledEstimatedFare(ride._id.toString());
          acceptDetails = await this.buildScheduledAcceptDetails(updatedRide, driverId, fare);
        } else {
          const fare = await this.getEstimatedFare(ride._id.toString(), vehicle?.vehicleType);
          acceptDetails = await this.buildAcceptDetails(updatedRide, driverId, fare || { total: 0 } as FareBreakdown);
        }
        await this.rideChannelService.publishDriverAccepted(ride.rideUUId, acceptDetails);
        await this.rideChannelService.publishRideTaken(ride.rideUUId, ride._id.toString());
        await this.rideChannelService.publishDriverResponseToRideChannel(ride.rideUUId, {
          rideId: ride._id.toString(), driverId, action: 'accept', driverName,
          driverImage: acceptDetails?.driver?.profileImage ?? null, rating: acceptDetails?.driver?.rating ?? null,
          vehicleType: acceptDetails?.vehicle?.vehicleType ?? null, vehicleModel: acceptDetails?.vehicle?.vehicleModel ?? null,
          color: acceptDetails?.vehicle?.color ?? null, numberPlate: acceptDetails?.vehicle?.numberPlate ?? null,
          estimatedFare: acceptDetails?.estimatedFare ?? ride.estimatedFare ?? null,
          estimatedTimeInMinutes: acceptDetails?.estimatedTimeInMinutes ?? ride.estimatedTimeInMinutes ?? null,
          distanceInKm: ride.distanceInKm ?? null,
        });
        if (ride.passengerId) {
          const passengerUser = await this.userModel.findById(ride.passengerId).exec();
          if (passengerUser) {
            const ablyChannelId = `WG-RIDE-${rideUUID}-ride-details`;
            const notificationInput: CreateNotificationInput = { title: 'Ride Accepted', notificationType: NotificationType.RIDE_ACCEPTED, description: 'Your ride request has been accepted by a driver. They are on their way to pick you up!', ablyChannelId };
             this.notificationService.createNotification(notificationInput, passengerUser);
          }
        }
        this.logger.log(`Driver ${driverId} accepted ride ${rideUUID}`);
        return { success: true, message: 'Ride accepted successfully', acceptedDetails: acceptDetails };
      } else if (action === 'reject') {
        await this.rideChannelService.publishDriverResponseToRideChannel(ride.rideUUId, {
          rideId: ride._id.toString(), driverId, action: 'reject', driverName,
          driverImage: null, rating: null, vehicleType: null, vehicleModel: null, color: null, numberPlate: null,
          estimatedFare: null, estimatedTimeInMinutes: null, distanceInKm: null,
        });
        if (ride.passengerId) {
          const passengerUser = await this.userModel.findById(ride.passengerId).exec();
          if (passengerUser) {
            const ablyChannelId = `WG-RIDE-${rideUUID}-ride-details`;
            const notificationInput: CreateNotificationInput = { title: 'Ride Rejected', notificationType: NotificationType.RIDE_REQUEST, description: 'A driver has declined your ride request. We are looking for other drivers.', ablyChannelId };
            this.notificationService.createNotification(notificationInput, passengerUser);
          }
        }
        this.logger.log(`Driver ${driverId} rejected ride ${rideUUID}`);
        return { success: true, message: 'Ride rejected' };
      }
    } catch (err) {
      this.logger.warn(`Failed to handle driver response: ${err}`);
      return { success: false, message: 'Failed to process driver response' };
    }
    return { success: false, message: 'Invalid action' };
  }

  // ════════════════════════════════════════════════════════════════
  //  Fare estimation
  // ════════════════════════════════════════════════════════════════

  async getEstimatedFare(rideId: string,vehicleType?: string): Promise<FareBreakdown | null> {
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
    if (!ride) return null;
    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const vehicleTypeNew = (vehicle?.vehicleType as string) || 'CAR';
    const pickupCoords = ride.pickupLocation?.coordinates;
    const dropoffCoords = ride.dropoffLocation?.coordinates;
    let distanceKm = ride.distanceInKm || 5;
    let durationMinutes = ride.estimatedTimeInMinutes || 15;
    if (pickupCoords && dropoffCoords && pickupCoords.length >= 2 && dropoffCoords.length >= 2) {
      try {
        const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0], vehicleTypeNew?.toLowerCase() || 'car');
        distanceKm = route.distanceKm;
        durationMinutes = route.durationMinutes;
      } catch {}
    }
    return this.pricingService.calculateFare({ distanceKm, durationMinutes, vehicleType });
  }

  async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<{ success: boolean; message: string }> {
    const driverObjectId = new Types.ObjectId(driverId);
    const updated = await this.userDetailsModel.findOneAndUpdate({ userId: driverObjectId, deleted: false }, { $set: { geoLocation: { type: 'Point', coordinates: [longitude, latitude] } } }, { new: true }).exec();
    if (!updated) return { success: false, message: 'Driver details not found' };
    this.logger.log(`Driver ${driverId} location updated: [${latitude}, ${longitude}]`);
    const vechicle = await this.vehicleModel.findOne({ driverId: driverObjectId, deleted: false }).exec();
    const activeRides = await this.ridesModel.find({ driverId: driverObjectId, rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING] }, deleted: false }).exec();

    for (const activeRide of activeRides) {
      const pickupCoords = activeRide.pickupLocation?.coordinates;
      if (pickupCoords && pickupCoords.length >= 2) {
        const pickupLat = pickupCoords[1];
        const pickupLng = pickupCoords[0];
        let distanceKm = 0;
        let durationMinutes = 0;
        try {
          const route = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, latitude, longitude,vechicle?.vehicleType.toLowerCase() || 'car');
          distanceKm = route.distanceKm;
          durationMinutes = route.durationMinutes;
        } catch (err) {
          this.logger.warn(`Failed to calculate distance for driver ${driverId}: ${err}`);
          const R = 6371;
          const dLat = (pickupLat - latitude) * Math.PI / 180;
          const dLng = (pickupLng - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(latitude * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceKm = R * c;
          durationMinutes = Math.ceil(distanceKm * 2);
        }

        await this.ridesModel.findByIdAndUpdate(activeRide._id, { $set: { distanceToReachPassenger: Math.round(distanceKm * 100) / 100, estimatedTimeToReachPassenger: Math.ceil(durationMinutes) } }).exec();
        await this.rideChannelService.publishDriverLocationUpdate(activeRide.rideUUId, { driverId, latitude, longitude, distanceToReachPassenger: Math.round(distanceKm * 100) / 100, estimatedTimeToReachPassenger: Math.ceil(durationMinutes), updatedAt: new Date().toISOString() });
        const fullDetails = await this.buildFullRideDetailsPayload(activeRide, { driverLocation: { latitude, longitude }, distanceToReachPassenger: Math.round(distanceKm * 100) / 100, estimatedTimeToReachPassenger: Math.ceil(durationMinutes), updatedAt: new Date().toISOString() });
        await this.rideChannelService.publishRideDetails(activeRide.rideUUId, fullDetails);
        this.logger.log(`Published driver location for ride ${activeRide.rideUUId} (status: ${activeRide.rideStatus}): dist=${distanceKm.toFixed(2)}km, time=${Math.ceil(durationMinutes)}min`);
      }
    }
    return { success: true, message: 'Location updated successfully' };
  }

  async updatePassengerLocation(passengerId: string, latitude: number, longitude: number): Promise<{ success: boolean; message: string }> {
    const passengerObjectId = new Types.ObjectId(passengerId);
    const activeRide = await this.ridesModel.findOne({ passengerId: passengerObjectId, rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING] }, deleted: false }).exec();
    if (!activeRide) return { success: false, message: 'No active ride found for this passenger' };

    const driverId = activeRide.driverId?.toString();
    let distanceKm = 0;
    let durationMinutes = 0;
  const vechicle = await this.vehicleModel.findById(activeRide.vehicleId).exec();
    if (driverId) {
      const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId), deleted: false }).exec();
      if (driverDetails?.geoLocation?.coordinates && driverDetails.geoLocation.coordinates.length >= 2) {
        const driverLat = driverDetails.geoLocation.coordinates[1];
        const driverLng = driverDetails.geoLocation.coordinates[0];
        try {
          const route = await this.distanceCalculator.calculateDriverDistance(driverLat, driverLng, latitude, longitude, vechicle?.vehicleType.toLowerCase() || 'car');
          distanceKm = route.distanceKm;
          durationMinutes = route.durationMinutes;
        } catch (err) {
          this.logger.warn(`Failed to calculate distance from driver to passenger: ${err}`);
          const R = 6371;
          const dLat = (driverLat - latitude) * Math.PI / 180;
          const dLng = (driverLng - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(latitude * Math.PI / 180) * Math.cos(driverLat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceKm = R * c;
          durationMinutes = Math.ceil(distanceKm * 2);
        }
      } else {
        const pickupCoords = activeRide.pickupLocation?.coordinates;
        if (pickupCoords && pickupCoords.length >= 2) {
          try {
            const route = await this.distanceCalculator.calculateDriverDistance(pickupCoords[1], pickupCoords[0], latitude, longitude, vechicle?.vehicleType.toLowerCase() || 'car');
            distanceKm = route.distanceKm;
            durationMinutes = route.durationMinutes;
          } catch (err) {
            this.logger.warn(`Failed to calculate distance from pickup to passenger: ${err}`);
          }
        }
      }
    }

    await this.ridesModel.findByIdAndUpdate(activeRide._id, { $set: { distanceToReachPassenger: Math.round(distanceKm * 100) / 100, estimatedTimeToReachPassenger: Math.ceil(durationMinutes) } }).exec();
    await this.rideChannelService.publishPassengerLocationUpdate(activeRide.rideUUId, { passengerId, latitude, longitude, distanceToReachPassenger: Math.round(distanceKm * 100) / 100, estimatedTimeToReachPassenger: Math.ceil(durationMinutes), updatedAt: new Date().toISOString() });
    const fullDetails = await this.buildFullRideDetailsPayload(activeRide, { passengerLocation: { latitude, longitude }, distanceToReachPassenger: Math.round(distanceKm * 100) / 100, estimatedTimeToReachPassenger: Math.ceil(durationMinutes), updatedAt: new Date().toISOString() });
    await this.rideChannelService.publishRideDetails(activeRide.rideUUId, fullDetails);
    this.logger.log(`Published passenger location for ride ${activeRide.rideUUId}: dist=${distanceKm.toFixed(2)}km, time=${Math.ceil(durationMinutes)}min`);
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
        const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0], vehicleType.toLowerCase());
        distanceKm = route.distanceKm;
        durationMinutes = route.durationMinutes;
      } catch {
        this.logger.log(`Failed to calculate distance for scheduled fare estimation, using defaults for ride ${rideId}`);
      }
    }
    return this.pricingService.calculateScheduledFare({ distanceKm, durationMinutes, vehicleType });
  }

  async getVehicleEstimates(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    noOfPassengers: number;
  }): Promise<VehicleEstimateGraphQL[]> {
 

    let vehicleTypes = [VehicleType.CAR, VehicleType.MOTORBIKE, VehicleType.SCOOTER];
    if (params.noOfPassengers > 1) {
      vehicleTypes = [VehicleType.CAR];
    }

    return Promise.all(vehicleTypes.map(async (type) => {
      const route =await this.distanceCalculator.calculateDistance(params.pickupLat, params.pickupLng, params.dropoffLat, params.dropoffLng, type.toLowerCase());
      const fare = this.pricingService.calculateFare({
        distanceKm: route.distanceKm,
        durationMinutes: route.durationMinutes,
        vehicleType: type as VehicleType,
      });

      let comfortType = '';
      let hasAC: boolean | undefined = undefined;

      if (type === VehicleType.CAR) {
        comfortType = 'Comfortable city ride with fast pickup';
        hasAC = true;
      } else if (type === VehicleType.MOTORBIKE) {
        comfortType = 'Affordable and quick';
           hasAC = false;
      } else if (type === VehicleType.SCOOTER) {
        comfortType = 'Short and quick ride';
        hasAC = false;
      }

      return {
        vehicleType: type as VehicleType,
        estimatedFare: fare.total,
        distanceKm: Math.round(route.distanceKm * 100) / 100,
        estimatedTimeInMinutes: route.durationMinutes,
        comfortType,
        hasAC,
        noOfPassengers: params.noOfPassengers,
      };
    }));
  }

  // ════════════════════════════════════════════════════════════════
  //  Build acceptance details payloads
  // ════════════════════════════════════════════════════════════════

  private async buildAcceptDetails(ride: RidesDocument, driverId: string, estimatedFare: FareBreakdown): Promise<any> {
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();
    return {
      rideId: ride._id.toString(), rideUUId: ride.rideUUId,
      driver: { driverId, fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver', phone: driverUser?.phone || '', profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), rating: driverDetails?.rating ?? 0 },
      vehicle: { vehicleId: vehicle?._id?.toString() || '', vehicleModel: vehicle?.vehicleModel || '', vehicleType: vehicle?.vehicleType || '', color: vehicle?.color || '', numberPlate: vehicle?.numberPlate || '', year: vehicle?.year || 0 },
      passenger: { passengerId: ride.passengerId.toString(), fullName: '', phone: '' },
      pickupLocation: { address: ride.pickupLocation?.address || '', coordinates: ride.pickupLocation?.coordinates || [0, 0], city: ride.pickupLocation?.city },
      dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
      estimatedFare: estimatedFare?.total || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0, distanceInKm: ride.distanceInKm || 0, acceptedAt: new Date().toISOString(),
    };
  }

  private async buildScheduledAcceptDetails(ride: RidesDocument, driverId: string, estimatedFare: ScheduledFareBreakdown): Promise<any> {
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();
    return {
      rideId: ride._id.toString(), rideUUId: ride.rideUUId,
      driver: { driverId, fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver', phone: driverUser?.phone || '', profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), rating: driverDetails?.rating ?? 0 },
      vehicle: { vehicleId: vehicle?._id?.toString() || '', vehicleModel: vehicle?.vehicleModel || '', vehicleType: vehicle?.vehicleType || '', color: vehicle?.color || '', numberPlate: vehicle?.numberPlate || '', year: vehicle?.year || 0 },
      passenger: { passengerId: ride.passengerId.toString(), fullName: '', phone: '' },
      pickupLocation: { address: ride.pickupLocation?.address || '', coordinates: ride.pickupLocation?.coordinates || [0, 0], city: ride.pickupLocation?.city },
      dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
      estimatedFare: estimatedFare?.total || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0, distanceInKm: ride.distanceInKm || 0,
      bookingTime: ride.bookingTime, acceptedAt: new Date().toISOString(),
    };
  }

  // ════════════════════════════════════════════════════════════════
  //  Build full ride details payload
  // ════════════════════════════════════════════════════════════════

  private async buildFullRideDetailsPayload(
    ride: RidesDocument,
    overrides: Partial<import('@libs/services/ably').RideDetailsPayload> = {},
  ): Promise<import('@libs/services/ably').RideDetailsPayload> {
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();
    const passengerDetails = await this.userDetailsModel.findOne({ userId: ride.passengerId, deleted: false }).exec();

    let driver: import('@libs/services/ably').RideDetailsPayload['driver'] = undefined;
    if (ride.driverId) {
      const driverUser = await this.userModel.findById(ride.driverId).exec();
      const driverDetails = await this.userDetailsModel.findOne({ userId: ride.driverId, deleted: false }).exec();
      driver = { driverId: ride.driverId.toString(), fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver', phone: driverUser?.phone || '', profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), rating: driverDetails?.rating ?? 0 };
    }

    let vehicle: import('@libs/services/ably').RideDetailsPayload['vehicle'] = undefined;
    const vehicleDoc = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    if (vehicleDoc) {
      vehicle = { vehicleId: vehicleDoc._id?.toString() || '', vehicleModel: vehicleDoc.vehicleModel || '', vehicleType: vehicleDoc.vehicleType || '', color: vehicleDoc.color || '', numberPlate: vehicleDoc.numberPlate || '', year: vehicleDoc.year || 0 };
    }

    return {
      rideId: ride._id.toString(), rideUUId: ride.rideUUId, rideType: ride.rideType, rideStatus: ride.rideStatus, bookingTime: ride.bookingTime?.toISOString(),
      pickupLocation: ride.pickupLocation ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city } : undefined,
      dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
      distanceInKm: ride.distanceInKm || 0, estimatedFare: ride.estimatedFare || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
      passenger: { passengerId: ride.passengerId.toString(), fullName: passengerUser?.fullName || passengerDetails?.fullName || 'Passenger', phone: passengerUser?.phone || '', profileImage: getActiveProfileImageUrl(passengerDetails?.profileImages, (key) => this.s3.getPublicUrl(key)) },
      driver, vehicle,
      rideStartedAt: ride.rideStartedAt?.toISOString(), rideCompletedAt: ride.rideCompletedAt?.toISOString(), updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }
}