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
import { MATCHMAKING_CONFIG, toMongoId } from '@libs/common';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';
import { S3Service } from '@libs/s3';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  /** Track active driver location channel subscriptions: driverId -> unsubscribe function */
  private readonly driverLocationSubscriptions = new Map<string, () => void>();

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
    private readonly transactionService: TransactionService,
  ) { }

  async matchDrivers(params: { rideId: string }): Promise<MatchResult> {
    const { rideId } = params;
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).populate('vehicleId').exec();
    if (!ride) return { matched: false, rideId, rideUUId: '', passengerId: '', attempts: [], message: 'Ride not found' };
    if (ride.rideStatus !== RideStatus.PENDING) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: `Ride is not in PENDING status. Current: ${ride.rideStatus}` };
    if (ride.rideType !== RideTypes.INSTANT) return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), attempts: [], message: 'Use matchScheduledDrivers for SCHEDULED rides.' };
    const result = await this.executeExpandingRingMatch(ride);
    this.logger.log(`result`, JSON.stringify(result));
    return { ...result, ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details` };
  }

  async matchScheduledDrivers(params: { rideId: string }): Promise<{ matched: boolean; rideId: string; rideUUId: string; passengerId: string; driverId?: string; driverName?: string; estimatedFare?: ScheduledFareBreakdown; attempts: MatchAttemptResult[]; message: string; ablyChannelId?: string; acceptedDetails?: any }> {
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
        const route = await this.distanceCalculator.calculateDistance(pickupLat, pickupLng, dropoffCoords[1], dropoffCoords[0], requestedType);
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch (err) { this.logger.warn(`Failed to calculate route for scheduled fare: ${err}`); }
    }

    const scheduledFare = this.pricingService.calculateScheduledFare({ distanceKm: routeDistanceKm, durationMinutes: routeDurationMinutes, vehicleType: requestedType });
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();
    const passengerDetails = await this.userDetailsModel.findOne({ userId: ride.passengerId }).exec();
    const passengerName = passengerUser?.fullName || passengerDetails?.fullName || 'Passenger';
    const passengerPhone = passengerUser?.phone || '';
    const passengerProfileImages = passengerDetails?.profileImages?.map(img => getActiveProfileImageUrl([img], (key) => this.s3.getPublicUrl(key))).filter(Boolean) || [];
    const passengerSnapshot = { fullName: passengerName, profileImage: passengerProfileImages?.[0] || '', rating: (passengerDetails?.rating ?? 0), phone: passengerPhone };
    const radii = MATCHMAKING_CONFIG.SCHEDULED_FALLBACK_RADII_KM;
    const attempts: MatchAttemptResult[] = [];
    let matched = false;
    let acceptedDriverId: string | undefined;
    let acceptedDriverName: string | undefined;
    const respondedDriverIds: Set<string> = new Set();

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const currentRide = await this.ridesModel.findById(ride._id).exec();
      if (!currentRide || currentRide.rideStatus !== RideStatus.PENDING) break;
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = MATCHMAKING_CONFIG.SCHEDULED_ATTEMPT_WAIT_SECONDS;
      this.logger.log(`[SCHEDULED] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km radius`);
      const drivers = await this.findAvailableScheduledDrivers(pickupLat, pickupLng, radiusKm, requestedType, attemptIdx, ride.bookingTime, ride.passengerId.toString());
      const filteredDrivers = drivers.filter((d) => !respondedDriverIds.has(d.driverId));
      if (filteredDrivers.length === 0) {
        attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false, status: 'no_drivers_found' });
        continue;
      }
      const scoredDrivers = this.scoreDrivers(filteredDrivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);
      const driverIds = requestBatch.map((d) => d.driverId);
      const { promise: driverResponsePromise, unsubscribe } = this.subscribeForDriverResponse(ride.rideUUId, driverIds, waitTimeSeconds * 1000);
      for (const driver of requestBatch) {
        if (respondedDriverIds.has(driver.driverId)) continue;
        await this.rideChannelService.publishMatchmakingRideRequest(ride.rideUUId, { rideId, rideType: ride.rideType, bookingTime: ride.bookingTime?.toISOString(), pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city }, dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null, distanceInKm: routeDistanceKm, estimatedFare: scheduledFare.total, estimatedTimeInMinutes: routeDurationMinutes, passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm, expirySeconds: waitTimeSeconds, attemptNumber: attemptIdx + 1, isScheduled: true, driverImage: driver.profileImage || null, rating: driver.rating, driverId: driver.driverId, driverName: driver.fullName, passengerSnapshot });
        try {
          const driverUser = await this.userModel.findById(new Types.ObjectId(driver.driverId)).exec();
          if (driverUser) {
            const ablyChannelId = ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`;
            await this.notificationService.createNotification({
              title: 'New Scheduled Ride Request', notificationType: NotificationType.RIDE_REQUEST,
              description: `You have a scheduled ride request from pickup ${ride.pickupLocation?.address || 'your area'} for ${ride.bookingTime ? new Date(ride.bookingTime).toLocaleString() : ''}. Estimated fare: Rs. ${scheduledFare.total}`,
              ablyChannelId, pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
              dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
              distanceInKm: routeDistanceKm, estimatedFare: scheduledFare.total, estimatedTimeInMinutes: routeDurationMinutes, passengerId: ride.passengerId.toString(), passengerSnapshot,
            }, driverUser);
          }
        } catch (err) { this.logger.warn(`Failed to send scheduled ride request notification to driver ${driver.driverId}: ${err}`); }
      }
      const driverResponse = await driverResponsePromise;
      unsubscribe();
      requestBatch.forEach((d) => respondedDriverIds.add(d.driverId));
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
    const scheduledAcceptDetails = await this.buildScheduledAcceptDetails(ride, acceptedDriverId!, scheduledFare);
    return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, estimatedFare: scheduledFare, attempts, message: 'Scheduled driver matched successfully', ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`, acceptedDetails: scheduledAcceptDetails };
  }

  private async executeExpandingRingMatch(ride: RidesDocument): Promise<MatchResult> {
    const rideId = ride._id.toString();
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();
    const passengerDetails = await this.userDetailsModel.findOne({ userId: ride.passengerId }).exec();
    const passengerName = passengerUser?.fullName || passengerDetails?.fullName || 'Passenger';
    const passengerPhone = passengerUser?.phone || '';
    const passengerProfileImages = passengerDetails?.profileImages?.map(img => getActiveProfileImageUrl([img], (key) => this.s3.getPublicUrl(key))).filter(Boolean) || [];
    const passengerSnapshot = { fullName: passengerName, profileImage: passengerProfileImages?.[0] || '', rating: (passengerDetails?.rating ?? 0), phone: passengerPhone };
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
        const route = await this.distanceCalculator.calculateDistance(pickupLat, pickupLng, dropoffCoords[1], dropoffCoords[0], requestedType.toLowerCase());
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch { }
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
    const respondedDriverIds: Set<string> = new Set();

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const currentRide = await this.ridesModel.findById(ride._id).exec();
      if (!currentRide || currentRide.rideStatus !== RideStatus.PENDING) break;
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = DRIVER_RESPONSE_TIMEOUT_SECONDS;
      this.logger.log(`[INSTANT] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km`);
      const drivers = await this.findAvailableDrivers(pickupLat, pickupLng, radiusKm, requestedType, attemptIdx, ride.passengerId.toString());
      const filteredDrivers = drivers.filter((d) => !respondedDriverIds.has(d.driverId));
      if (filteredDrivers.length === 0) {
        attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false, status: 'no_drivers_found' });
        continue;
      }
      const scoredDrivers = this.scoreDrivers(filteredDrivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);
      const driverIds = requestBatch.map((d) => d.driverId);
      const { promise: driverResponsePromise, unsubscribe } = this.subscribeForDriverResponse(ride.rideUUId, driverIds, waitTimeSeconds * 1000);
      for (const driver of requestBatch) {
        if (respondedDriverIds.has(driver.driverId)) continue;
        try {
          const driverUser = await this.userModel.findById(new Types.ObjectId(driver.driverId)).exec();
          if (driverUser) {
            const ablyChannelId = ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`;
            this.logger.log(`Sending ride request notification to driver ${driver.driverId}`);
            const notificationInput: CreateNotificationInput = {
              title: 'New Ride Request', notificationType: NotificationType.RIDE_REQUEST,
              description: `You have a new ride request from pickup ${ride.pickupLocation?.address || 'your area'}. Estimated fare: Rs. ${estimatedFare.total}`,
              ablyChannelId, rideId, rideType: ride.rideType, rideStatus: ride.rideStatus, waitTimeSeconds: DRIVER_RESPONSE_TIMEOUT_SECONDS,
              pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
              dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
              distanceInKm: routeDistanceKm, estimatedFare: estimatedFare.total, estimatedTimeInMinutes: routeDurationMinutes,
              passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
              passengerSnapshot, noOfPassengers: ride.noOfPassengers,
            };
            await this.notificationService.createNotification(notificationInput, driverUser);
          }
          await this.rideChannelService.publishMatchmakingRideRequest(ride.rideUUId, {
            rideId, rideType: ride.rideType,
            pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
            dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
            distanceInKm: routeDistanceKm, estimatedFare: estimatedFare.total, estimatedTimeInMinutes: routeDurationMinutes,
            passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
            expirySeconds: waitTimeSeconds, attemptNumber: attemptIdx + 1,
            driverImage: driver.profileImage || null, rating: driver.rating,
            driverId: driver.driverId, driverName: driver.fullName,
            passengerSnapshot, noOfPassengers: ride.noOfPassengers,
          });
        } catch (err) { this.logger.warn(`Failed to send ride request notification to driver ${driver.driverId}: ${err}`); }
      }
      const driverResponse = await driverResponsePromise;
      unsubscribe();
      requestBatch.forEach((d) => respondedDriverIds.add(d.driverId));
      if (driverResponse.accepted) {
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        const acceptedDriver = requestBatch.find((d) => d.driverId === driverResponse.driverId);
        acceptedDriverName = acceptedDriver?.fullName || 'Driver';
        acceptedDriverImage = acceptedDriver?.profileImage;
        acceptedRating = acceptedDriver?.rating;
        const acceptDetails = await this.buildAcceptDetails(ride, acceptedDriverId, estimatedFare);
        return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, driverImage: acceptedDriverImage, rating: acceptedRating, estimatedFare, attempts, message: 'Driver matched successfully', acceptedDetails: acceptDetails };
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

  private async findAvailableDrivers(pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number, passengerId?: string): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel.find({ vehicleType: vehicleType as VehicleType }).populate('driverId').limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING).exec();
    const drivers: DriverScore[] = [];
    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;
      if (passengerId && driver._id.toString() === passengerId) continue;
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;
      const userDetails = await this.userDetailsModel.findOne({ userId: driver._id }).exec();
      if (userDetails?.driverOnlineStatus !== DriverOnlineStatus.ONLINE) continue;
      const activeRide = await this.ridesModel.findOne({ driverId: driver._id, rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] } }).exec();
      if (activeRide) continue;
      const driverRating = userDetails.rating ?? 0;
      let driverLat: number; let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLat = userDetails.geoLocation.coordinates[0]; driverLng = userDetails.geoLocation.coordinates[1];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5); driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng, vehicleType.toLowerCase());
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = await this.ridesModel.countDocuments({ driverId: driver._id, rideStatus: RideStatus.COMPLETED, deleted: false }).exec();
        drivers.push({ driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '', profileImage: getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)), vehicleId: v._id.toString(), vehicleModel: v.vehicleModel, vehicleType: v.vehicleType, color: v.color, numberPlate: v.numberPlate, distanceToPickupKm: distResult.distanceKm, rating: driverRating, completedTripsCount, score: 0, estimatedTimeToReachMinutes: distResult.durationMinutes });
      }
    }
    return drivers;
  }

  private async findAvailableScheduledDrivers(pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number, bookingTime: Date, passengerId?: string): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel.find({ vehicleType: vehicleType as VehicleType, deleted: false }).populate('driverId').limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING).exec();
    const drivers: DriverScore[] = [];
    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;
      if (passengerId && driver._id.toString() === passengerId) continue;
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
      let driverLat: number; let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLng = userDetails.geoLocation.coordinates[0]; driverLat = userDetails.geoLocation.coordinates[1];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5); driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng, vehicleType.toLowerCase());
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = await this.ridesModel.countDocuments({ driverId: driver._id, rideStatus: RideStatus.COMPLETED, deleted: false }).exec();
        drivers.push({ driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '', profileImage: getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)), vehicleId: v._id.toString(), vehicleModel: v.vehicleModel, vehicleType: v.vehicleType, color: v.color, numberPlate: v.numberPlate, distanceToPickupKm: distResult.distanceKm, rating: driverRating, completedTripsCount, score: 0, estimatedTimeToReachMinutes: distResult.durationMinutes });
      }
    }
    return drivers;
  }

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

  private subscribedListeners = new Map<string, (message: any) => void>();

  private subscribeForDriverResponse(rideUUID: string, driverIds: string[], timeoutMs: number): { promise: Promise<{ accepted: boolean; driverId?: string; rejectedDriverIds: string[] }>; unsubscribe: () => void } {
    const rejectedDriverIds: string[] = [];
    let resolved = false;
    let resolvePromise: (value: { accepted: boolean; driverId?: string; rejectedDriverIds: string[] }) => void;
    const promise = new Promise<{ accepted: boolean; driverId?: string; rejectedDriverIds: string[] }>((resolve) => { resolvePromise = resolve; });
    const timeout = setTimeout(() => { if (!resolved) { resolved = true; resolvePromise({ accepted: false, rejectedDriverIds }); } }, timeoutMs);
    const channelName = `WG-RIDE-${rideUUID}-ride-details`;
    const listenerKey = `${rideUUID}-${Date.now()}`;
    const handler = (message: any) => {
      const response = message.data as { eventType?: string; driverId: string; action: 'accept' | 'reject' };
      if (response.eventType === 'driver-response') {
        if (response.action === 'accept' && driverIds.includes(response.driverId) && !resolved) {
          resolved = true; clearTimeout(timeout);
          this.ablyService.unsubscribe(channelName, 'ride-detail', handler);
          this.subscribedListeners.delete(listenerKey);
          resolvePromise({ accepted: true, driverId: response.driverId, rejectedDriverIds });
        } else if (response.action === 'reject' && driverIds.includes(response.driverId) && !rejectedDriverIds.includes(response.driverId)) {
          rejectedDriverIds.push(response.driverId);
          if (rejectedDriverIds.length >= driverIds.length && !resolved) {
            resolved = true; clearTimeout(timeout);
            this.ablyService.unsubscribe(channelName, 'ride-detail', handler);
            this.subscribedListeners.delete(listenerKey);
            resolvePromise({ accepted: false, rejectedDriverIds });
          }
        }
      }
    };
    this.subscribedListeners.set(listenerKey, handler);
    this.ablyService.subscribe(channelName, 'ride-detail', handler);
    const unsubscribe = () => { if (!resolved) { resolved = true; clearTimeout(timeout); } this.ablyService.unsubscribe(channelName, 'ride-detail', handler); this.subscribedListeners.delete(listenerKey); };
    return { promise, unsubscribe };
  }

  async handleDriverResponse(rideUUID: string, driverId: string, action: 'accept' | 'reject'): Promise<{ success: boolean; message: string; acceptedDetails?: any }> {
    try {
      const ride = await this.ridesModel.findOne({ rideUUId: rideUUID }).exec();
      if (!ride) return { success: false, message: 'Ride not found' };
      const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
      const driverName = driverUser?.fullName ?? null;
      const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId), deleted: false }).exec();
      if (action === 'accept') {
        const pickupCoords = ride.pickupLocation?.coordinates;
        const dropoffCoords = ride.dropoffLocation?.coordinates;
        const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
        let routeDistanceKm = ride.distanceInKm || 0;
        let routeDurationMinutes = ride.estimatedTimeInMinutes || 0;
        let driverToPickupDistanceKm = 0;
        let driverToPickupDurationMinutes = 0;
        if (pickupCoords?.[1] && dropoffCoords?.[1]) {
          try {
            const vType = (vehicle?.vehicleType as string)?.toLowerCase() || 'car';
            const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0], vType);
            routeDistanceKm = route.distanceKm;
            routeDurationMinutes = route.durationMinutes;
          } catch { }
        }
        if (driverDetails?.geoLocation?.coordinates && pickupCoords?.[1]) {
          try {
            const vType = (vehicle?.vehicleType as string)?.toLowerCase() || 'car';
            const dist = await this.distanceCalculator.calculateDriverDistance(pickupCoords[1], pickupCoords[0], driverDetails.geoLocation.coordinates[1], driverDetails.geoLocation.coordinates[0], vType);
            driverToPickupDistanceKm = Math.round(dist.distanceKm * 100) / 100;
            driverToPickupDurationMinutes = Math.ceil(dist.durationMinutes);
          } catch { }
        }
        let totalFare: number | undefined;
        let fare: FareBreakdown | ScheduledFareBreakdown | null = null;
        if (ride.rideType === RideTypes.INSTANT) {
          fare = await this.getEstimatedFare(ride._id.toString(), vehicle?.vehicleType);
          totalFare = fare?.total;
        } else {
          fare = await this.getScheduledEstimatedFare(ride._id.toString());
          totalFare = fare?.total;
        }
        const distanceFare = fare?.distanceCost || 0;
        const baseFare = fare?.baseFare || 0;
        const totalAmount = fare?.total || 0;

        const updatedRide = await this.ridesModel.findOneAndUpdate({ _id: ride._id, rideStatus: RideStatus.PENDING }, { $set: { driverId: new Types.ObjectId(driverId), rideStatus: RideStatus.CONFIRMED, distanceInKm: routeDistanceKm, estimatedTimeInMinutes: routeDurationMinutes, estimatedFare: totalFare || ride.estimatedFare || 0, distanceToReachPassenger: driverToPickupDistanceKm, estimatedTimeToReachPassenger: driverToPickupDurationMinutes, timeToReachPassengerInMinutes: driverToPickupDurationMinutes, fare: { baseAmount: baseFare, trafficCongestionAmount: 0, distanceAmount: Math.round(distanceFare * 100) / 100, totalAmount: Math.round(totalAmount * 100) / 100, noOfPassengers: ride.noOfPassengers || 1, discountAmount: 0, promoCodeId: null } } }, { new: true }).exec();
        if (!updatedRide) return { success: false, message: 'Ride was already accepted by another driver' };
        let acceptDetails: any;
        const rideFare = fare || (ride.rideType === RideTypes.SCHEDULED
          ? { baseFare: 0, total: 0, pickupCost: 0, distanceCost: 0, durationCost: 0 }
          : { pickupCost: 0, distanceCost: 0, durationCost: 0, total: 0, baseFare: 0 });
        if (ride.rideType === RideTypes.SCHEDULED) {
          acceptDetails = await this.buildScheduledAcceptDetails(updatedRide, driverId, rideFare);
        } else {
          acceptDetails = await this.buildAcceptDetails(updatedRide, driverId, rideFare);
        }
        if (ride.passengerId) {
          const passengerUser = await this.userModel.findById(ride.passengerId).exec();
          if (passengerUser) {
            const ablyChannelId = `WG-RIDE-${rideUUID}-ride-details`;
            const driverSnapshot = { fullName: acceptDetails?.driver?.fullName || driverName || 'Driver', profileImage: acceptDetails?.driver?.profileImage || null, rating: acceptDetails?.driver?.rating || null, phone: acceptDetails?.driver?.phone || driverUser?.phone || '' };
            const notificationInput: CreateNotificationInput = {
              title: 'Ride Accepted', notificationType: NotificationType.RIDE_ACCEPTED,
              description: 'Your ride request has been accepted by a driver. They are on their way to pick you up!',
              ablyChannelId, driverName: acceptDetails?.driver?.fullName || driverName || 'Driver',
              driverPhone: acceptDetails?.driver?.phone || driverUser?.phone || '', driverProfileImage: acceptDetails?.driver?.profileImage || null, driverRating: acceptDetails?.driver?.rating || null,
              vehicleType: acceptDetails?.vehicle?.vehicleType || vehicle?.vehicleType || null, vehicleModel: acceptDetails?.vehicle?.vehicleModel || vehicle?.vehicleModel || null,
              vehicleColor: acceptDetails?.vehicle?.color || vehicle?.color || null, vehicleNumberPlate: acceptDetails?.vehicle?.numberPlate || vehicle?.numberPlate || null,
              pickupLocation: ride.pickupLocation ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city } : undefined,
              dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
              distanceInKm: ride.distanceInKm || null, estimatedFare: acceptDetails?.estimatedFare || ride.estimatedFare || null,
              estimatedTimeInMinutes: acceptDetails?.estimatedTimeInMinutes || ride.estimatedTimeInMinutes || null,
              driverSnapshot,
            };
            this.notificationService.createNotification(notificationInput, passengerUser);

          }
        }
        await this.rideChannelService.publishRideEvent(rideUUID, 'driver-response', { driverId, action });

        this.logger.log(`Driver ${driverId} accepted ride ${rideUUID}`);
        return { success: true, message: 'Ride accepted successfully', acceptedDetails: acceptDetails };
      } else if (action === 'reject') {
        await this.rideChannelService.publishDriverResponseToRideChannel(ride.rideUUId, { rideId: ride._id.toString(), driverId, action: 'reject', driverName, driverImage: null, rating: null, vehicleType: null, vehicleModel: null, color: null, numberPlate: null, estimatedFare: null, estimatedTimeInMinutes: null, distanceInKm: null });
        if (ride.passengerId) {
          const passengerUser = await this.userModel.findById(ride.passengerId).exec();
          if (passengerUser) {
            const ablyChannelId = `WG-RIDE-${rideUUID}-ride-details`;
            const notificationInput: CreateNotificationInput = { title: 'Ride Rejected', notificationType: NotificationType.RIDE_REQUEST, description: 'A driver has declined your ride request. We are looking for other drivers.', ablyChannelId };
            this.notificationService.createNotification(notificationInput, passengerUser);
          }
        }
        await this.rideChannelService.publishRideEvent(rideUUID, 'driver-response', { driverId, action });

        return { success: true, message: 'Ride rejected' };
      }
    } catch (err) {
      this.logger.warn(`Failed to handle driver response: ${err}`);
      return { success: false, message: 'Failed to process driver response' };
    }
    return { success: false, message: 'Invalid action' };
  }

  async getEstimatedFare(rideId: string, vehicleType?: string): Promise<FareBreakdown | null> {
    const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
    if (!ride) return null;
    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const vehicleTypeNew = (vehicle?.vehicleType as string) || 'CAR';
    const pickupCoords = ride.pickupLocation?.coordinates;
    const dropoffCoords = ride.dropoffLocation?.coordinates;
    let distanceKm = ride.distanceInKm || 5;
    let durationMinutes = ride.estimatedTimeInMinutes || 15;
    if (pickupCoords && dropoffCoords && pickupCoords.length >= 2 && dropoffCoords.length >= 2) {
      try { const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0], vehicleTypeNew?.toLowerCase() || 'car'); distanceKm = route.distanceKm; durationMinutes = route.durationMinutes; } catch { }
    }
    return this.pricingService.calculateFare({ distanceKm, durationMinutes, vehicleType });
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
      try { const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0], vehicleType.toLowerCase()); distanceKm = route.distanceKm; durationMinutes = route.durationMinutes; } catch { this.logger.log(`Failed to calculate distance for scheduled fare estimation, using defaults for ride ${rideId}`); }
    }
    return this.pricingService.calculateScheduledFare({ distanceKm, durationMinutes, vehicleType });
  }

  async startRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} starting ride ${rideId}`);
    try {
      const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
      if (!ride) return { success: false, message: 'Ride not found' };
      if (!ride.driverId || ride.driverId.toString() !== driverId) return { success: false, message: 'You are not the assigned driver for this ride' };
      if (ride.rideStatus !== RideStatus.PICKUP) return { success: false, message: `Driver must pickup passenger (PICKUP) before starting ride. Current: ${ride.rideStatus}` };

      const updatedRide = await this.ridesModel.findByIdAndUpdate(ride._id, { $set: { rideStatus: RideStatus.ONGOING, rideStartedAt: new Date() } }, { new: true }).exec();
      if (!updatedRide) return { success: false, message: 'Failed to update ride status' };


      // Publish ride-start event with start time and remaining time to destination
      await this.rideChannelService.publishRideStarted(ride.rideUUId, {
        rideId: ride._id.toString(),
        rideStartedAt: new Date().toISOString(),
        estimatedTimeInMinutes: updatedRide.estimatedTimeInMinutes || 0,
        distanceInKm: updatedRide.distanceInKm || 0,
      });

      const passenger = await this.userModel.findById(ride.passengerId).exec();
      if (passenger) {
        await this.notificationService.createNotification({
          title: 'Ride has started',
          notificationType: NotificationType.RIDE_START,
          description: `Your ride has started.Remaining distance: ${updatedRide.distanceInKm || 0} km. Estimated time: ${updatedRide.estimatedTimeInMinutes || 0} minutes.`,
          ablyChannelId: updatedRide.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
          driverName: updatedRide.driverId?.toString() || '',
          pickupLocation: updatedRide.pickupLocation,
          dropoffLocation: updatedRide.dropoffLocation,
          distanceInKm: updatedRide.distanceInKm || 0,
          estimatedTimeInMinutes: updatedRide.estimatedTimeInMinutes,
          passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
        }, passenger);
      }

      this.logger.log(`Ride ${ride.rideUUId} started by driver ${driverId}`);
      return { success: true, message: 'Ride started successfully.' };
    } catch (err: any) {
      this.logger.error(`Failed to start ride: ${err?.message || err}`);
      return { success: false, message: 'Failed to start ride' };
    }
  }

  /**
   * Process driver location updates for all active rides.
   * Calculates distance to pickup/dropoff, updates ride docs, publishes to ride channel,
   * and sends proximity notifications through Ably.
   */
  private async processDriverLocationForRides(
    driverId: string,
    latitude: number,
    longitude: number,
    vehicleType: string,
  ): Promise<void> {
    const driverObjectId = new Types.ObjectId(driverId);
    const activeRides = await this.ridesModel.find({
      driverId: driverObjectId,
      rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
      rideType: RideTypes.INSTANT,
      deleted: false,
    }).exec();

    for (const activeRide of activeRides) {
      const pickupCoords = activeRide.pickupLocation?.coordinates;
      const dropoffCoords = activeRide.dropoffLocation?.coordinates;

      if (pickupCoords && pickupCoords.length >= 2) {
        const pickupLat = pickupCoords[1];
        const pickupLng = pickupCoords[0];
        let distanceKm = 0;
        let durationMinutes = 0;

        try {
          const route = await this.distanceCalculator.calculateDriverDistance(
            pickupLat, pickupLng, latitude, longitude, vehicleType,
          );
          distanceKm = route.distanceKm;
          durationMinutes = route.durationMinutes;
        } catch {
          const R = 6371;
          const dLat = (pickupLat - latitude) * Math.PI / 180;
          const dLng = (pickupLng - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(latitude * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceKm = R * c;
          durationMinutes = Math.ceil(distanceKm * 2);
        }

        // Update ride document with distance/time to reach passenger
        await this.ridesModel.findByIdAndUpdate(activeRide._id, {
          $set: {
            distanceToReachPassenger: Math.round(distanceKm * 100) / 100,
            estimatedTimeToReachPassenger: Math.ceil(durationMinutes),
          },
        }).exec();

        // Publish to the ride channel
        if (distanceKm  >  0.3)
          await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-moving', {
            rideId: activeRide._id.toString(),
            driverId,
            latitude,
            longitude,
            distanceToPickupKm: Math.round(distanceKm * 100) / 100,
            estimatedTimeToPickupMinutes: Math.ceil(durationMinutes),
            message: `Driver is ${distanceKm.toFixed(2)} km away.`,
          });

        // --- "Driver is arriving" — within 1km of pickup (CONFIRMED rides only) ---
        if (activeRide.rideStatus === RideStatus.CONFIRMED && distanceKm <= 0.3 && !activeRide.driverArrivingNotified) {
          await this.ridesModel.findByIdAndUpdate(activeRide._id, { $set: { driverArrivingNotified: true } }).exec();
          const passenger = await this.userModel.findById(activeRide.passengerId).exec();
          if (passenger) {
            await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-arriving', {
              rideId: activeRide._id.toString(),
              driverId,
              latitude,
              longitude,
              distanceToPickupKm: Math.round(distanceKm * 100) / 100,
              estimatedTimeToPickupMinutes: Math.ceil(durationMinutes),
              message: `Driver is at the ${distanceKm.toFixed(2)} km away.`,
            });
            await this.notificationService.createNotification({
              title: 'Driver is arriving',
              rideId: activeRide._id.toString(),
              notificationType: NotificationType.RIDE_DETAILS,
              description: `Your driver is ${distanceKm.toFixed(2)} km away. Estimated arrival in ${Math.ceil(durationMinutes)} minutes.`,
              ablyChannelId: activeRide.ablyChannelId || `WG-RIDE-${activeRide.rideUUId}-ride-details`,
              driverName: activeRide.driverId?.toString() || '',
              pickupLocation: activeRide.pickupLocation,
              dropoffLocation: activeRide.dropoffLocation,
              distanceInKm: distanceKm,
              estimatedTimeInMinutes: Math.ceil(durationMinutes),
              passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
            }, passenger);
          }
        }
        if (activeRide.rideStatus === RideStatus.CONFIRMED && distanceKm <= 0.05 ) {
          await this.ridesModel.findByIdAndUpdate(activeRide._id, { $set: { driverArrivingNotified: true } }).exec();
          const passenger = await this.userModel.findById(activeRide.passengerId).exec();
          if (passenger) {
            await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-arrived', {
              rideId: activeRide._id.toString(),
              driverId,
              latitude,
              longitude,
              distanceToPickupKm: Math.round(distanceKm * 100) / 100,
              estimatedTimeToPickupMinutes: Math.ceil(durationMinutes),
              message: `Driver is at the pickup location ${distanceKm.toFixed(2)} km away.`,
            });
            await this.notificationService.createNotification({
              title: 'Driver is at pickup location',
              notificationType: NotificationType.RIDE_DETAILS,
              rideId: activeRide._id.toString(),
              description: `Your driver is at pickup location`,
              ablyChannelId: activeRide.ablyChannelId || `WG-RIDE-${activeRide.rideUUId}-ride-details`,
              driverName: activeRide.driverId?.toString() || '',
              pickupLocation: activeRide.pickupLocation,
              dropoffLocation: activeRide.dropoffLocation,
              distanceInKm: distanceKm,
              estimatedTimeInMinutes: Math.ceil(durationMinutes),
              passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
            }, passenger);
          }
        }

        // --- "Driver has arrived at destination" — within 1km of dropoff (ONGOING/PICKUP) ---
        if ((activeRide.rideStatus === RideStatus.ONGOING || activeRide.rideStatus === RideStatus.PICKUP) &&
          dropoffCoords && dropoffCoords.length >= 2) {
          const dropoffLat = dropoffCoords[1];
          const dropoffLng = dropoffCoords[0];
          let dropoffDistanceKm = 0;
          let dropoffDurationMinutes = 0;


          try {
            const dropoffRoute = await this.distanceCalculator.calculateDriverDistance(
              dropoffLat, dropoffLng, latitude, longitude, vehicleType,
            );
            dropoffDistanceKm = dropoffRoute.distanceKm;
            dropoffDurationMinutes = dropoffRoute.durationMinutes;
          } catch {
            const R = 6371;
            const dLat = (dropoffLat - latitude) * Math.PI / 180;
            const dLng = (dropoffLng - longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(latitude * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            dropoffDistanceKm = R * c;
            dropoffDurationMinutes = Math.ceil(dropoffDistanceKm * 2);
          }

          // Update ride document with remaining distance/time to destination
          await this.ridesModel.findByIdAndUpdate(activeRide._id, {
            $set: {
              distanceInKm: Math.round(dropoffDistanceKm * 100) / 100,
              estimatedTimeInMinutes: Math.ceil(dropoffDurationMinutes),
            },
          }).exec();

          if (dropoffDistanceKm  > 0.05 && !activeRide.driverArrivedAtDestinationNotified)
            await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-moving-destination', {
              rideId: activeRide._id.toString(),
              driverId,
              latitude,
              longitude,
              distanceToDropoffKm: Math.round(dropoffDistanceKm * 100) / 100,
              dropoffDurationMinutes,
              message: `Driver is ${distanceKm.toFixed(2)} km away.`,
            });

          if (dropoffDistanceKm <= 0.05 && !activeRide.driverArrivedAtDestinationNotified) {
            await this.ridesModel.findByIdAndUpdate(activeRide._id, { $set: { driverArrivedAtDestinationNotified: true } }).exec();
            const passenger = await this.userModel.findById(activeRide.passengerId).exec();
            if (passenger) {
              await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-arrived-destination', {
                rideId: activeRide._id.toString(),
                driverId,
                latitude,
                longitude,
                distanceToDropoffKm: Math.round(dropoffDistanceKm * 100) / 100,
                dropoffDurationMinutes,
                message: `Driver has arrived at the destination.`,
              });
              await this.notificationService.createNotification({
                title: 'Driver has arrived at destination',
                rideId: activeRide._id.toString(),
                notificationType: NotificationType.RIDE_DETAILS,
                description: `Your driver has arrived at the destination.`,
                ablyChannelId: activeRide.ablyChannelId || `WG-RIDE-${activeRide.rideUUId}-ride-details`,
                driverName: activeRide.driverId?.toString() || '',
                pickupLocation: activeRide.pickupLocation,
                dropoffLocation: activeRide.dropoffLocation,
                distanceInKm: dropoffDistanceKm,
                estimatedTimeInMinutes: 0,
                passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
              }, passenger);
            }
          }
        }
      }
    }
  }

  /**
   * Subscribe to a driver's personal location channel for continuous ride matchmaking.
   * When a driver goes online (location channel is created/activated), this method
   * listens for location updates and processes them for ride matchmaking.
   * 
   * @param driverId - The driver's ID
   * @returns true if subscription was created, false if already subscribed
   */
  async subscribeToDriverLocationChannel(driverId: string): Promise<boolean> {
    // If already subscribed, unsubscribe first to re-subscribe fresh
    if (this.driverLocationSubscriptions.has(driverId)) {
      this.logger.warn(`Driver ${driverId} already subscribed to location channel. Re-subscribing.`);
      this.unsubscribeFromDriverLocationChannel(driverId);
    }

    const unsubscribe = this.rideChannelService.subscribeToDriverLocationChannel(
      driverId,
      async (data: any) => {
        const { driverId: dId, lat, lng } = data;
        this.logger.log(`latiude ${lat}`)
        this.logger.log(`latiude ${lng}`)
        this.logger.log(`driverId ${dId}`)
        if (!dId || lat == null || lng == null) return;

        // Update geo-location in DB
        const driverObjectId = new Types.ObjectId(dId);
        await this.userDetailsModel.findOneAndUpdate(
          { userId: driverObjectId, deleted: false },
          { $set: { geoLocation: { type: 'Point', coordinates: [lat, lng] } } },
        ).exec();

        // Process active rides for this location update
        const vehicle = await this.vehicleModel.findOne({ driverId: driverObjectId, deleted: false }).exec();
        await this.processDriverLocationForRides(
          dId,
          lat,
          lng,
          vehicle?.vehicleType?.toLowerCase() || 'car',
        );
      },
    );

    this.driverLocationSubscriptions.set(driverId, unsubscribe);
    this.logger.log(`Subscribed to driver ${driverId} location channel for matchmaking`);
    return true;
  }

  /**
   * Unsubscribe from a driver's personal location channel.
   * Called when a driver goes offline.
   */
  async unsubscribeFromDriverLocationChannel(driverId: string): Promise<void> {
    const unsubscribe = this.driverLocationSubscriptions.get(driverId);
    if (unsubscribe) {
      unsubscribe();
      this.driverLocationSubscriptions.delete(driverId);
      this.logger.log(`Unsubscribed from driver ${driverId} location channel`);
    }
  }

  async pickupPassenger(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} picked up passenger for ride ${rideId}`);
    try {
      const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
      if (!ride) return { success: false, message: 'Ride not found' };
      if (!ride.driverId || ride.driverId.toString() !== driverId) return { success: false, message: 'You are not the assigned driver for this ride' };
      if (ride.rideStatus !== RideStatus.CONFIRMED) return { success: false, message: `Ride must be CONFIRMED before pickup. Current: ${ride.rideStatus}` };

      const dropoffCoords = ride.dropoffLocation?.coordinates;
      let remainingDistanceKm = ride.distanceInKm || 0;
      if (dropoffCoords?.[1] && dropoffCoords?.[0]) {
        try {
          const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
          const vType = (vehicle?.vehicleType as string)?.toLowerCase() || 'car';
          const pickupCoords = ride.pickupLocation?.coordinates;
          if (pickupCoords?.length >= 2) {
            const route = await this.distanceCalculator.calculateDistance(pickupCoords[1], pickupCoords[0], dropoffCoords[1], dropoffCoords[0], vType);
            remainingDistanceKm = route.distanceKm;
          }
        } catch { }
      }

      const updatedRide = await this.ridesModel.findByIdAndUpdate(ride._id, { $set: { rideStatus: RideStatus.PICKUP, distanceInKm: remainingDistanceKm } }, { new: true }).exec();
      if (!updatedRide) return { success: false, message: 'Failed to update ride status' };

      const fullDetails = await this.buildFullRideDetailsPayload(updatedRide, { rideStatus: RideStatus.PICKUP, distanceInKm: remainingDistanceKm });
      await this.rideChannelService.publishRideDetails(ride.rideUUId, fullDetails);

      const passenger = await this.userModel.findById(ride.passengerId).exec();
      if (passenger) {
        await this.notificationService.createNotification({
          title: 'Driver has arrived',
          notificationType: NotificationType.RIDE_START,
          description: `Your driver has arrived at pickup location. Remaining distance: ${remainingDistanceKm.toFixed(2)} km. Estimated time: ${updatedRide.estimatedTimeInMinutes || 0} minutes.`,
          ablyChannelId: updatedRide.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
          driverName: updatedRide.driverId?.toString() || '',
          pickupLocation: updatedRide.pickupLocation,
          dropoffLocation: updatedRide.dropoffLocation,
          distanceInKm: remainingDistanceKm,
          estimatedTimeInMinutes: updatedRide.estimatedTimeInMinutes,
          passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
        }, passenger);
      }

      this.logger.log(`Passenger picked up for ride ${ride.rideUUId} by driver ${driverId}`);
      return { success: true, message: 'Driver arrived at pickup location.' };
    } catch (err: any) {
      this.logger.error(`Failed to pickup passenger: ${err?.message || err}`);
      return { success: false, message: 'Failed to pickup passenger' };
    }
  }

  /**
   * Complete a ride: validates ride, updates status to COMPLETED,
   * calculates actual duration and fare breakdown, publishes ride-completed Ably event.
   * All fare calculation and DB update logic is centralized here.
   */
  async completeRide(rideId: string, driverId: string): Promise<{
    success: boolean;
    message: string;
    data?: {
      rideId: string;
      rideUUId: string;
      rideStatus: string;
      totalDurationInMinutes: number;
      totalDuration: string;
      fareBreakdown: { baseFare: number; distanceCharge: number; discount: number; totalFare: number; };
      completedAt: string;
    };
  }> {
    this.logger.log(`Driver ${driverId} completing ride ${rideId}`);
    try {
      const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
      if (!ride) {
        return { success: false, message: 'Ride not found' };
      }

      if (ride.driverId?.toString() !== driverId) {
        return { success: false, message: 'You are not the assigned driver for this ride' };
      }

      if (ride.rideStatus !== RideStatus.ONGOING) {
        return { success: false, message: `Ride must be ONGOING to complete. Current: ${ride.rideStatus}` };
      }

      const vehicle = await this.vehicleModel.findById(ride.vehicleId).exec();
      const distanceInKm = ride.distanceInKm || 0;
      const durationInMinutes = ride.estimatedTimeInMinutes || 0;
      const rideStartedAt = new Date(ride.rideStartedAt);
      const rideCompletedAt = new Date();

      const actualCompleteDurationInMinutes =
        Math.floor((rideCompletedAt.getTime() - rideStartedAt.getTime()) / (1000 * 60));

      // Fare calculation constants
      const baseFare = MATCHMAKING_CONFIG.FARE.BASE_PICKUP_COST[vehicle?.vehicleType] || 0;
      const perKmRate = MATCHMAKING_CONFIG.FARE.PER_KM_RATE[vehicle?.vehicleType] || 0;
      //const perMinuteRate = MATCHMAKING_CONFIG.FARE.PER_MINUTE_RATE[vehicle?.vehicleType] || 0;

      const baseFareAmount = Number(baseFare);
      const distanceFare = Number(distanceInKm) * Number(perKmRate);
      const durationFare = 0
      const totalFare = Number(baseFareAmount) + Number(distanceFare) + Number(durationFare);

      const discountAmount = Number(ride.paymentDetails?.discountAmount || 0);
      const finalAmount = totalFare - discountAmount;

      const commissionRate = Number(ride.paymentDetails?.driverCommission) || 0.2;

      const updatedRide = await this.ridesModel.findByIdAndUpdate(
        ride._id,
        {
          $set: {
            rideStatus: RideStatus.COMPLETED,
            rideCompletedAt: new Date(),
            distanceInKm: distanceInKm,
            estimatedTimeInMinutes: durationInMinutes,
            actualCompletedDurationInMinutes: actualCompleteDurationInMinutes,
            estimatedFare: totalFare,
            fare: {
              baseAmount: baseFareAmount,
              distanceAmount: distanceFare,
              totalAmount: finalAmount,
              noOfPassengers: ride.noOfPassengers || 1,
              driverCommission: Number(commissionRate),
            },
          },
        },
        { new: true },
      ).exec();

      if (!updatedRide) {
        return { success: false, message: 'Failed to update ride to completed' };
      }

      const totalDurationMinutes = actualCompleteDurationInMinutes;
      const distanceCharge = Number(distanceFare).toFixed(2);
      const hrs = Math.floor(totalDurationMinutes / 60);
      const mins = totalDurationMinutes % 60;
      const durationStr = hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + 'm';

      await this.rideChannelService.publishRideCompleted(updatedRide.rideUUId, {
        rideId: updatedRide._id.toString(),
        rideUUId: updatedRide.rideUUId,
        rideStatus: RideStatus.COMPLETED,
        totalDurationInMinutes: totalDurationMinutes,
        totalDuration: durationStr,
        fareBreakdown: { baseFare: baseFareAmount, distanceCharge: Number(distanceCharge), discount: discountAmount, totalFare: Number(finalAmount) },
        completedAt: updatedRide.rideCompletedAt.toISOString(),
      });

      const passenger = await this.userModel.findById(updatedRide.passengerId).exec();
      if (passenger) {
        await this.notificationService.createNotification({
          title: 'Ride completed',
          notificationType: NotificationType.RIDE_COMPLETE_NOTIFICATION,
          description: 'Ride completed. Duration: ' + durationStr + '. Fare: Rs.' + finalAmount,
          ablyChannelId: updatedRide.ablyChannelId || 'WG-RIDE-' + updatedRide.rideUUId + '-ride-details',
          pickupLocation: updatedRide.pickupLocation,
          dropoffLocation: updatedRide.dropoffLocation,
          distanceInKm: distanceInKm,
          estimatedTimeInMinutes: updatedRide.estimatedTimeInMinutes,
          actualTimeInMinutes: totalDurationMinutes,
          passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
        }, passenger);
      }

      return {
        success: true,
        message: 'Ride completed successfully.',
        data: {
          rideId: updatedRide._id.toString(),
          rideUUId: updatedRide.rideUUId,
          rideStatus: RideStatus.COMPLETED,
          totalDurationInMinutes: totalDurationMinutes,
          totalDuration: durationStr,
          fareBreakdown: { baseFare: baseFareAmount, distanceCharge: Number(distanceCharge), discount: discountAmount, totalFare: Number(finalAmount) },
          completedAt: updatedRide.rideCompletedAt.toISOString(),
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to complete ride: ' + (err?.message || err));
      return { success: false, message: 'Failed to complete ride' };
    }
  }



  async getVehicleEstimates(params: { pickupLat: number; pickupLng: number; dropoffLat: number; dropoffLng: number; noOfPassengers: number }): Promise<VehicleEstimateGraphQL[]> {
    let vehicleTypes = [VehicleType.CAR, VehicleType.MOTORBIKE, VehicleType.SCOOTER];
    if (params.noOfPassengers > 1) vehicleTypes = [VehicleType.CAR];
    return Promise.all(vehicleTypes.map(async (type) => {
      const route = await this.distanceCalculator.calculateDistance(params.pickupLat, params.pickupLng, params.dropoffLat, params.dropoffLng, type.toLowerCase());
      const fare = this.pricingService.calculateFare({ distanceKm: route.distanceKm, durationMinutes: route.durationMinutes, vehicleType: type as VehicleType });
      let comfortType = ''; let hasAC: boolean | undefined = undefined;
      if (type === VehicleType.CAR) { comfortType = 'Comfortable city ride with fast pickup'; hasAC = true; } else if (type === VehicleType.MOTORBIKE) { comfortType = 'Affordable and quick'; hasAC = false; } else if (type === VehicleType.SCOOTER) { comfortType = 'Short and quick ride'; hasAC = false; }
      return { vehicleType: type as VehicleType, estimatedFare: fare.total, distanceKm: Math.round(route.distanceKm * 100) / 100, estimatedTimeInMinutes: route.durationMinutes, comfortType, hasAC, noOfPassengers: params.noOfPassengers };
    }));
  }

  private async buildAcceptDetails(ride: RidesDocument, driverId: string, estimatedFare: FareBreakdown): Promise<any> {
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();
    const passengerDetails = await this.userDetailsModel.findOne({ userId: ride.passengerId }).exec();
    return { rideId: ride._id.toString(), rideUUId: ride.rideUUId, driver: { driverId, fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver', phone: driverUser?.phone || '', profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), rating: driverDetails?.rating ?? 0 }, vehicle: { vehicleId: vehicle?._id?.toString() || '', vehicleModel: vehicle?.vehicleModel || '', vehicleType: vehicle?.vehicleType || '', color: vehicle?.color || '', numberPlate: vehicle?.numberPlate || '', year: vehicle?.year || 0 }, passenger: { passengerId: ride.passengerId.toString(), fullName: passengerDetails?.fullName || passengerUser?.fullName || 'Passenger', phone: passengerUser?.phone || '', profileImage: getActiveProfileImageUrl(passengerDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), gender: passengerDetails?.gender }, pickupLocation: { address: ride.pickupLocation?.address || '', coordinates: ride.pickupLocation?.coordinates || [0, 0], city: ride.pickupLocation?.city }, dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined, estimatedFare: estimatedFare?.total || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0, distanceInKm: ride.distanceInKm || 0, acceptedAt: new Date().toISOString() };
  }

  private async buildScheduledAcceptDetails(ride: RidesDocument, driverId: string, estimatedFare: ScheduledFareBreakdown): Promise<any> {
    const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
    const driverDetails = await this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec();
    const vehicle = await this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec();
    const passengerUser = await this.userModel.findById(ride.passengerId).exec();
    const passengerDetails = await this.userDetailsModel.findOne({ userId: ride.passengerId }).exec();
    return { rideId: ride._id.toString(), rideUUId: ride.rideUUId, driver: { driverId, fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver', phone: driverUser?.phone || '', profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), rating: driverDetails?.rating ?? 0 }, vehicle: { vehicleId: vehicle?._id?.toString() || '', vehicleModel: vehicle?.vehicleModel || '', vehicleType: vehicle?.vehicleType || '', color: vehicle?.color || '', numberPlate: vehicle?.numberPlate || '', year: vehicle?.year || 0 }, passenger: { passengerId: ride.passengerId.toString(), fullName: passengerDetails?.fullName || passengerUser?.fullName || 'Passenger', phone: passengerUser?.phone || '', profileImage: getActiveProfileImageUrl(passengerDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), gender: passengerDetails?.gender }, pickupLocation: { address: ride.pickupLocation?.address || '', coordinates: ride.pickupLocation?.coordinates || [0, 0], city: ride.pickupLocation?.city }, dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined, estimatedFare: estimatedFare?.total || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0, distanceInKm: ride.distanceInKm || 0, bookingTime: ride.bookingTime, acceptedAt: new Date().toISOString() };
  }

  private async buildFullRideDetailsPayload(ride: RidesDocument, overrides: Partial<import('@libs/services/ably').RideDetailsPayload> = {}): Promise<import('@libs/services/ably').RideDetailsPayload> {
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
    if (vehicleDoc) { vehicle = { vehicleId: vehicleDoc._id?.toString() || '', vehicleModel: vehicleDoc.vehicleModel || '', vehicleType: vehicleDoc.vehicleType || '', color: vehicleDoc.color || '', numberPlate: vehicleDoc.numberPlate || '', year: vehicleDoc.year || 0 }; }
    return { rideId: ride._id.toString(), rideUUId: ride.rideUUId, rideType: ride.rideType, rideStatus: ride.rideStatus, bookingTime: ride.bookingTime?.toISOString(), pickupLocation: ride.pickupLocation ? { address: ride.pickupLocation.address, coordinates: ride.pickupLocation.coordinates, city: ride.pickupLocation.city } : undefined, dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined, distanceInKm: ride.distanceInKm || 0, estimatedFare: ride.estimatedFare || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0, passenger: { passengerId: ride.passengerId.toString(), fullName: passengerUser?.fullName || passengerDetails?.fullName || 'Passenger', phone: passengerUser?.phone || '', profileImage: getActiveProfileImageUrl(passengerDetails?.profileImages, (key) => this.s3.getPublicUrl(key)) }, driver, vehicle, rideStartedAt: ride.rideStartedAt?.toISOString(), rideCompletedAt: ride.rideCompletedAt?.toISOString(), updatedAt: new Date().toISOString(), ...overrides };
  }
}