import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { User, UserDocument } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsDocument } from '@libs/data-access/entities/user-details.entity';
import { UserDailyOnlineStatus, UserDailyOnlineStatusDocument } from '@libs/data-access/entities/user-daily-online-status.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { PromoCode, PromoCodeDocument } from '@libs/data-access/entities/promo-code.entity';
import { PromoCodeUsed, PromoCodeUsedDocument } from '@libs/data-access/entities/promo-code-used.entity';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { VehicleType } from '@libs/data-access/enums/vehicle.enum';
import { roles, DriverOnlineStatus, ridePreference } from '@libs/data-access/enums/user.enum';
import { NotificationType } from '@libs/data-access/enums/notification.enum';
import { PromoCodeStatusEnum, DiscountTypeEnum, AppliedToEnum } from '@libs/data-access/enums/promo-code.enum';
import { CreateNotificationInput } from '@libs/data-access/dtos/input/create-notification.input';
import { AblyService, RideChannelService } from '@libs/services/ably';
import { NotificationService } from '@libs/services/notification';
import { WalletService } from '@libs/services/payment/src/wallet/wallet.service';
import {
  MatchResult,
  MatchAttemptResult,
  DriverScore,
  FareBreakdown,
  RainCondition,
  HistoricalTraffic,
  ScheduledFareBreakdown,
  VehicleEstimateGraphQL,
  PaymentStatusEnum,
} from '@libs/data-access';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';
import { MATCHMAKING_CONFIG, toMongoId } from '@libs/common';
import { getActiveProfileImageUrl } from '@libs/common/utils/entity.utils';
import { S3Service } from '@libs/s3';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  /** Track active driver location channel subscriptions: driverId -> unsubscribe function */
  private readonly driverLocationSubscriptions = new Map<string, () => void>();

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserDetails.name) private readonly userDetailsModel: Model<UserDetailsDocument>,
    @InjectModel(UserDailyOnlineStatus.name) private readonly userDailyOnlineStatusModel: Model<UserDailyOnlineStatusDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    @InjectModel(PromoCode.name) private readonly promoCodeModel: Model<PromoCodeDocument>,
    @InjectModel(PromoCodeUsed.name) private readonly promoCodeUsedModel: Model<PromoCodeUsedDocument>,
    private readonly ablyService: AblyService,
    private readonly rideChannelService: RideChannelService,
    private readonly distanceCalculator: DistanceCalculatorService,
    private readonly pricingService: DynamicPricingService,
    private readonly notificationService: NotificationService,
    private readonly s3: S3Service,
    private readonly walletService: WalletService,
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

    // Persist the fare to the ride document so handleDriverResponse can use it
    await this.ridesModel.findByIdAndUpdate(ride._id, {
      $set: {
        distanceInKm: Math.round(routeDistanceKm),
        estimatedFare: scheduledFare.total,
        fare: {
          baseAmount: scheduledFare.baseFare,
          trafficCongestionAmount: 0,
          distanceAmount: Math.round(scheduledFare.distanceCost),
          totalAmount: Math.round(scheduledFare.total),
          noOfPassengers: ride.noOfPassengers || 1,
          discountAmount: 0,
          promoCodeId: null,
        },
      },
    }).exec();

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

      // Batch-fetch all driver users for this batch in a single query
      const driverObjectIds = driverIds.map((id) => new Types.ObjectId(id));
      const driverUsersMap = new Map<string, UserDocument>();
      const driverUsers = await this.userModel.find({ _id: { $in: driverObjectIds } }).exec();
      for (const du of driverUsers) {
        driverUsersMap.set(du._id.toString(), du);
      }

      for (const driver of requestBatch) {
        if (respondedDriverIds.has(driver.driverId)) continue;
        const driverUser = driverUsersMap.get(driver.driverId);
        if (driverUser) {
          const ablyChannelId = ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`;
          this.notificationService.createNotification({
            title: 'New Scheduled Ride Request', notificationType: NotificationType.RIDE_REQUEST,
            description: `You have a scheduled ride request from pickup ${ride.pickupLocation?.address || 'your area'} for ${ride.bookingTime ? new Date(ride.bookingTime).toLocaleString() : ''}. Estimated fare: Rs. ${scheduledFare.total}`,
            ablyChannelId, pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
            dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
            distanceInKm: routeDistanceKm, estimatedFare: scheduledFare.total, estimatedTimeInMinutes: routeDurationMinutes, passengerId: ride.passengerId.toString(), passengerSnapshot,
          }, driverUser);
        }
      }
      const driverResponse = await driverResponsePromise;
      unsubscribe();
      requestBatch.forEach((d) => respondedDriverIds.add(d.driverId));
      if (driverResponse.accepted) {
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        acceptedDriverName = requestBatch.find((d) => d.driverId === driverResponse.driverId)?.fullName || 'Driver';
        await this.ridesModel.findByIdAndUpdate(ride._id, { driverId: new Types.ObjectId(acceptedDriverId), rideStatus: RideStatus.CONFIRMED, isFavourite: 0 });
      }
      attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: scoredDrivers.length, driversRequested: requestBatch.length, driverAccepted: driverResponse.accepted, acceptedDriverId: driverResponse.driverId, timeoutExpired: !driverResponse.accepted, status: driverResponse.accepted ? 'accepted' : 'timeout' });
    }
    if (!matched) {
      const failMessage = 'No available drivers found within 15 km radius for your scheduled time. Please try a different time.';
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

    // Persist the freshly calculated pickup-to-dropoff distance, fare, and fare breakdown to the ride document
    // so that handleDriverResponse and downstream consumers use the accurate values
    await this.ridesModel.findByIdAndUpdate(ride._id, {
      $set: {
        distanceInKm: routeDistanceKm,
        estimatedFare: estimatedFare.total,
        fare: {
          baseAmount: estimatedFare.baseFare,
          subTotal: estimatedFare.total,
          trafficCongestionAmount: 0,
          distanceAmount: Math.round(estimatedFare.distanceCost),
          totalAmount: Math.round(estimatedFare.total),
          noOfPassengers: ride.noOfPassengers || 1,
          discountAmount: 0,
          promoCodeId: null,
        },
      },
    }).exec();
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

      // Check ride status at the START of each attempt iteration.
      // This catches cancellations that happened during the previous attempt's
      // Ably subscription wait (which can take up to 20s).
      const attemptStartRide = await this.ridesModel.findById(ride._id).exec();
      if (!attemptStartRide) {
        this.logger.log(`Ride ${ride.rideUUId} was deleted during matchmaking (attempt-start check). Aborting.`);
        return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
      }
      if (attemptStartRide.rideStatus !== RideStatus.PENDING) {
        if (attemptStartRide.rideStatus === RideStatus.CANCELLED) {
          this.logger.log(`Ride ${ride.rideUUId} was cancelled by user (attempt-start check). Aborting matchmaking.`);
          return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
        }
        break;
      }

      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds = DRIVER_RESPONSE_TIMEOUT_SECONDS;
      this.logger.log(`[INSTANT] Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km`);
      const drivers = await this.findAvailableDrivers(pickupLat, pickupLng, radiusKm, requestedType, attemptIdx, ride.passengerId.toString(), ride.rideType);
      const filteredDrivers = drivers.filter((d) => !respondedDriverIds.has(d.driverId));
      if (filteredDrivers.length === 0) {
        attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: 0, driversRequested: 0, driverAccepted: false, timeoutExpired: false, status: 'no_drivers_found' });
        continue;
      }
      const scoredDrivers = this.scoreDrivers(filteredDrivers);
      const batchSize = Math.min(MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE, scoredDrivers.length);
      const requestBatch = scoredDrivers.slice(0, batchSize);
      const driverIds = requestBatch.map((d) => d.driverId);

      // Batch-fetch all driver users for this batch in a single query
      const driverObjectIds = driverIds.map((id) => new Types.ObjectId(id));
      const driverUsersMap = new Map<string, UserDocument>();
      const driverUsers = await this.userModel.find({ _id: { $in: driverObjectIds } }).exec();
      for (const du of driverUsers) {
        driverUsersMap.set(du._id.toString(), du);
      }

      // Notify drivers ONE AT A TIME in score order (highest scored first).
      // This prevents race conditions where multiple drivers at the same location
      // all get notified simultaneously and race to accept the same ride.
      // Each driver gets their full waitTimeSeconds to respond before the next
      // driver is notified.
      let lastDriverResponse: { accepted: boolean; driverId?: string; rejectedDriverIds: string[] } | null = null;
      for (const driver of requestBatch) {
        const currentRide = await this.ridesModel.findById(ride._id).exec();
        // If ride was deleted (by cancelInstantRide) or status changed to CANCELLED, abort matchmaking
        if (!currentRide) {
          this.logger.log(`Ride ${ride.rideUUId} was deleted during matchmaking. Aborting.`);
          return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
        }
        if (currentRide.rideStatus !== RideStatus.PENDING) {
          if (currentRide.rideStatus === RideStatus.CANCELLED) {
            this.logger.log(`Ride ${ride.rideUUId} was cancelled by user. Aborting matchmaking.`);
            return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
          }
          break;
        }
        if (respondedDriverIds.has(driver.driverId)) continue;
        const driverUser = driverUsersMap.get(driver.driverId);
        if (driverUser) {
          const ablyChannelId = ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`;
          this.logger.log(`Sending ride request notification to driver ${driver.driverId} with ${waitTimeSeconds}s to respond`);
          const notificationInput: CreateNotificationInput = {
            title: 'New Ride Request', notificationType: NotificationType.RIDE_REQUEST,
            description: `You have a new ride request from pickup ${ride.pickupLocation?.address || 'your area'}. Estimated fare: Rs. ${estimatedFare.total}`,
            ablyChannelId, rideId, rideType: ride.rideType, rideStatus: ride.rideStatus, waitTimeSeconds,
            rideUUId: ride.rideUUId,
            pickupLocation: { address: ride.pickupLocation?.address, coordinates: ride.pickupLocation?.coordinates, city: ride.pickupLocation?.city },
            dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : null,
            distanceInKm: routeDistanceKm, estimatedFare: estimatedFare.total, estimatedTimeInMinutes: routeDurationMinutes,
            passengerId: ride.passengerId.toString(), driverScore: driver.score, distanceToPickupKm: driver.distanceToPickupKm,
            passengerSnapshot, noOfPassengers: ride.noOfPassengers,
            vehicleType: driver.vehicleType
          };
          try {
            await this.notificationService.createNotification(notificationInput, driverUser);
          } catch (err) {
            this.logger.error(`Failed to send notification to driver ${driver.driverId}: ${err}`);
            // If notification fails, skip this driver and try the next one
            respondedDriverIds.add(driver.driverId);
            continue;
          }
        }

        // Check ride status BEFORE subscribing to Ably - cancellation may have happened
        // during the notification-sending phase.
        const preSubscribeRideCheck = await this.ridesModel.findById(ride._id).exec();
        if (!preSubscribeRideCheck) {
          this.logger.log(`Ride ${ride.rideUUId} was deleted during matchmaking (pre-subscribe check). Aborting.`);
          return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
        }
        if (preSubscribeRideCheck.rideStatus !== RideStatus.PENDING) {
          if (preSubscribeRideCheck.rideStatus === RideStatus.CANCELLED) {
            this.logger.log(`Ride ${ride.rideUUId} was cancelled by user (pre-subscribe check). Aborting matchmaking.`);
            return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
          }
          break;
        }

        // Subscribe for just this single driver's response, giving them the full waitTimeSeconds
        const { promise: driverResponsePromise, unsubscribe } = this.subscribeForDriverResponse(ride.rideUUId, [driver.driverId], waitTimeSeconds * 1000);
        const driverResponse = await driverResponsePromise;
        unsubscribe();
        lastDriverResponse = driverResponse;

        // After the Ably promise resolves (whether by timeout, cancellation, or driver accept),
        // immediately check if the ride was cancelled during the wait.
        const postResponseRide = await this.ridesModel.findById(ride._id).exec();
        if (!postResponseRide) {
          this.logger.log(`Ride ${ride.rideUUId} was deleted during matchmaking (post-response check). Aborting.`);
          return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
        }
        if (postResponseRide.rideStatus !== RideStatus.PENDING) {
          if (postResponseRide.rideStatus === RideStatus.CANCELLED) {
            this.logger.log(`Ride ${ride.rideUUId} was cancelled by user (post-response check). Aborting matchmaking.`);
            return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: 'Ride was cancelled by the user' };
          }
          // If ride is CONFIRMED (accepted by another driver), break out of loop
          break;
        }

        respondedDriverIds.add(driver.driverId);
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
      }
      // Track attempt result - if we processed at least one driver, record the result
      const driverAccepted = lastDriverResponse?.accepted ?? false;
      const acceptedDriverIdForAttempt = lastDriverResponse?.driverId;
      const timeoutExpired = lastDriverResponse ? !lastDriverResponse.accepted : true;
      attempts.push({ attemptNumber: attemptIdx + 1, radiusKm, waitTimeSeconds, driversFound: scoredDrivers.length, driversRequested: requestBatch.length, driverAccepted, acceptedDriverId: acceptedDriverIdForAttempt, timeoutExpired, status: driverAccepted ? 'accepted' : 'timeout' });
    }
    if (!matched) {
      const failMessage = 'No available drivers found within 10 km radius. Please try scheduling your ride.';
      return { matched: false, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), estimatedFare, attempts, message: failMessage };
    }
    return { matched: true, rideId, rideUUId: ride.rideUUId, passengerId: ride.passengerId.toString(), driverId: acceptedDriverId, driverName: acceptedDriverName, driverImage: acceptedDriverImage, rating: acceptedRating, estimatedFare, attempts, message: 'Driver matched successfully' };
  }

  private async findAvailableDrivers(pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number, passengerId?: string, rideType?: RideTypes): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel.find({ vehicleType: vehicleType as VehicleType }).populate('driverId').limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING).exec();
    if (vehicles.length === 0) return [];

    // Filter out vehicles where the populated driverId is null (deleted/invalid user reference)
    const validVehicles = vehicles.filter((v) => v.driverId && (v.driverId as any as UserDocument)._id);
    if (validVehicles.length === 0) return [];

    // Batch-fetch all userDetails for the drivers in one query
    const driverIds = validVehicles.map((v) => (v.driverId as any as UserDocument)._id).filter(Boolean);
    this.logger.log(`Found ${driverIds.length} drivers for vehicle type ${vehicleType} in attempt ${attemptIndex + 1}`);
    const userDetailsDocs = await this.userDetailsModel.find({ userId: { $in: driverIds } }).exec();
    const userDetailsMap = new Map<string, UserDetailsDocument>();
    for (const ud of userDetailsDocs) {
      userDetailsMap.set(ud.userId.toString(), ud);
    }

    // Batch-fetch all active rides for these drivers in one query
    const activeRideDriverIds = driverIds.filter((did) => {
      const ud = userDetailsMap.get(did.toString());
      return ud?.driverOnlineStatus === DriverOnlineStatus.ONLINE;
    });
    this.logger.log(`Checking active rides for ${activeRideDriverIds.length} online drivers`);
    const activeRides = activeRideDriverIds.length > 0
      ? await this.ridesModel.find({
        driverId: { $in: activeRideDriverIds },
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
      }).exec()
      : [];
    const activeRideDriverIdSet = new Set(activeRides.map((r) => r.driverId.toString()));

    // Batch-fetch completed trip counts for all drivers in one aggregation
    const completedCounts = await this.ridesModel.aggregate([
      { $match: { driverId: { $in: driverIds }, rideStatus: RideStatus.COMPLETED, deleted: false } },
      { $group: { _id: '$driverId', count: { $sum: 1 } } },
    ]).exec();
    const completedCountsMap = new Map<string, number>();
    for (const c of completedCounts) {
      completedCountsMap.set(c._id.toString(), c.count);
    }

    const drivers: DriverScore[] = [];
    for (const v of validVehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver || !driver._id) continue;
      this.logger.log(`Checking driver ${driver._id} for availability: loginAs=${driver?.loginAs}, suspended=${driver?.suspended}, verified=${driver?.verified}`);
      if (passengerId && driver._id.toString() === passengerId) continue;
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;
      const userDetails = userDetailsMap.get(driver._id.toString());
      if (userDetails?.driverOnlineStatus !== DriverOnlineStatus.ONLINE) continue;
      if (userDetails?.ridePreference && userDetails.ridePreference !== rideType && userDetails.ridePreference !== ridePreference.BOTH) continue;
      if (activeRideDriverIdSet.has(driver._id.toString())) continue;
      const driverRating = userDetails.rating ?? 0;
      let driverLat: number; let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLat = userDetails.geoLocation.coordinates[0]; driverLng = userDetails.geoLocation.coordinates[1];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5); driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng, vehicleType.toLowerCase());
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = completedCountsMap.get(driver._id.toString()) || 0;
        drivers.push({ driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '', profileImage: getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)), vehicleId: v._id.toString(), vehicleModel: v.vehicleModel, vehicleType: v.vehicleType, color: v.color, numberPlate: v.numberPlate, distanceToPickupKm: distResult.distanceKm, rating: driverRating, completedTripsCount, score: 0, estimatedTimeToReachMinutes: distResult.durationMinutes });
      }
    }
    return drivers;
  }

  private async findAvailableScheduledDrivers(pickupLat: number, pickupLng: number, radiusKm: number, vehicleType: string, attemptIndex: number, bookingTime: Date, passengerId?: string): Promise<DriverScore[]> {
    const vehicles = await this.vehicleModel.find({ vehicleType: vehicleType as VehicleType, deleted: false }).populate('driverId').limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING).exec();
    if (vehicles.length === 0) return [];

    // Batch-fetch all userDetails for the drivers in one query
    const driverIds = vehicles.map((v) => (v.driverId as any as UserDocument)._id).filter(Boolean);
    this.logger.log(`Found ${driverIds.length} drivers for vehicle type ${vehicleType} in attempt ${attemptIndex + 1}`);
    const userDetailsDocs = await this.userDetailsModel.find({ userId: { $in: driverIds }, deleted: false }).exec();
    const userDetailsMap = new Map<string, UserDetailsDocument>();
    for (const ud of userDetailsDocs) {
      userDetailsMap.set(ud.userId.toString(), ud);
    }

    this.logger.log(`Checking conflicting rides for ${driverIds.length} drivers`);
    // Batch-fetch conflicting rides for these drivers in one query
    const conflictingRides = await this.ridesModel.find({
      driverId: { $in: driverIds },
      rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING] },
      bookingTime: {
        $gte: new Date(bookingTime.getTime() - 30 * 60 * 1000),
        $lte: new Date(bookingTime.getTime() + 30 * 60 * 1000),
      },
      deleted: false,
    }).exec();
    const conflictingRideDriverIdSet = new Set(conflictingRides.map((r) => r.driverId.toString()));

    // Batch-fetch completed trip counts for all drivers in one aggregation
    const completedCounts = await this.ridesModel.aggregate([
      { $match: { driverId: { $in: driverIds }, rideStatus: RideStatus.COMPLETED, deleted: false } },
      { $group: { _id: '$driverId', count: { $sum: 1 } } },
    ]).exec();
    const completedCountsMap = new Map<string, number>();
    for (const c of completedCounts) {
      completedCountsMap.set(c._id.toString(), c.count);
    }

    const drivers: DriverScore[] = [];
    const minRating = attemptIndex < MATCHMAKING_CONFIG.BYPASS_RATING_AFTER_ATTEMPTS ? MATCHMAKING_CONFIG.MIN_ACCEPT_RATING : 0;

    for (const v of vehicles) {
      const driver = v.driverId as any as UserDocument;
      if (!driver) continue;
      if (passengerId && driver._id.toString() === passengerId) continue;
      if (driver.loginAs !== roles.RIDER) continue;
      if (driver.suspended || !driver.verified) continue;
      const userDetails = userDetailsMap.get(driver._id.toString());
      if (!userDetails) continue;
      if (userDetails.ridePreference !== ridePreference.SCHEDULED && userDetails.ridePreference !== ridePreference.BOTH) continue;
      if (conflictingRideDriverIdSet.has(driver._id.toString())) continue;
      const driverRating = userDetails.rating ?? 0;

      let driverLat: number; let driverLng: number;
      if (userDetails.geoLocation?.coordinates && userDetails.geoLocation.coordinates.length >= 2) {
        driverLng = userDetails.geoLocation.coordinates[1]; driverLat = userDetails.geoLocation.coordinates[0];
      } else {
        driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5); driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);
      }
      const distResult = await this.distanceCalculator.calculateDriverDistance(pickupLat, pickupLng, driverLat, driverLng, vehicleType.toLowerCase());
      if (distResult.distanceKm <= radiusKm) {
        const completedTripsCount = completedCountsMap.get(driver._id.toString()) || 0;
        drivers.push({ driverId: driver._id.toString(), fullName: driver.fullName || 'Driver', phone: driver.phone || '', profileImage: getActiveProfileImageUrl(userDetails.profileImages, (key) => this.s3.getPublicUrl(key)), vehicleId: v._id.toString(), vehicleModel: v.vehicleModel, vehicleType: v.vehicleType, color: v.color, numberPlate: v.numberPlate, distanceToPickupKm: distResult.distanceKm, rating: driverRating, completedTripsCount, score: 0, estimatedTimeToReachMinutes: distResult.durationMinutes });
      }
    }
    this.logger.log(`Found ${drivers.length} available scheduled drivers within ${radiusKm} km radius`);
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

  /**
   * Map of rideUUID -> resolve function for pending subscribeForDriverResponse promises.
   * When cancelInstantRide is called, it looks up this map and immediately resolves
   * the waiting promise, bypassing the Ably event which may not echo back to the
   * publishing client.
   */
  private pendingDriverResponseResolvers = new Map<string, (value: { accepted: boolean; driverId?: string; rejectedDriverIds: string[] }) => void>();

  private subscribeForDriverResponse(rideUUID: string, driverIds: string[], timeoutMs: number): { promise: Promise<{ accepted: boolean; driverId?: string; rejectedDriverIds: string[] }>; unsubscribe: () => void } {
    const rejectedDriverIds: string[] = [];
    let resolved = false;
    let cancelled = false;
    let resolvePromise: (value: { accepted: boolean; driverId?: string; rejectedDriverIds: string[] }) => void;
    const promise = new Promise<{ accepted: boolean; driverId?: string; rejectedDriverIds: string[] }>((resolve) => { resolvePromise = resolve; });

    // Register this resolver so cancelInstantRide can force-resolve it immediately
    this.pendingDriverResponseResolvers.set(rideUUID, resolvePromise);

    const timeout = setTimeout(() => { if (!resolved) { resolved = true; this.pendingDriverResponseResolvers.delete(rideUUID); resolvePromise({ accepted: false, rejectedDriverIds }); } }, timeoutMs);
    const channelName = `WG-RIDE-${rideUUID}-ride-details`;
    const listenerKey = `${rideUUID}-${Date.now()}`;
    const handler = (message: any) => {
      const response = message.data as { eventType?: string; driverId: string; action: 'accept' | 'reject' };

      // If ride-cancelled event is received, immediately resolve to stop matchmaking
      if (response.eventType === 'ride-cancelled' && !resolved) {
        cancelled = true;
        resolved = true; clearTimeout(timeout);
        this.pendingDriverResponseResolvers.delete(rideUUID);
        resolvePromise({ accepted: false, rejectedDriverIds });
      }

      if (response.eventType === 'driver-response') {
        if (response.action === 'accept' && driverIds.includes(response.driverId) && !resolved) {
          resolved = true; clearTimeout(timeout);
          this.pendingDriverResponseResolvers.delete(rideUUID);

          resolvePromise({ accepted: true, driverId: response.driverId, rejectedDriverIds });
        } else if (response.action === 'reject' && driverIds.includes(response.driverId) && !rejectedDriverIds.includes(response.driverId)) {
          rejectedDriverIds.push(response.driverId);
          if (rejectedDriverIds.length >= driverIds.length && !resolved) {
            resolved = true; clearTimeout(timeout);
            this.pendingDriverResponseResolvers.delete(rideUUID);

            resolvePromise({ accepted: false, rejectedDriverIds });
          }
        }
      }
    };
    this.subscribedListeners.set(listenerKey, handler);
    this.ablyService.subscribe(channelName, RideChannelService.RIDE_EVENT, handler);
    // IMPORTANT: Only clear the timeout and mark as resolved.
    // Do NOT unsubscribe from the ride-details channel (`WG-RIDE-${rideUUID}-ride-details`).
    // The channel must remain active after driver accept/reject so that
    // both driver and passenger continue receiving ongoing ride updates
    // (driver location, ride status changes, pickup/dropoff events, etc.).
    const unsubscribe = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
      }
      this.pendingDriverResponseResolvers.delete(rideUUID);
      // Do NOT call this.ablyService.unsubscribe() here — the ride-details channel
      // subscription must persist for the entire ride lifecycle.
    };
    return { promise, unsubscribe };
  }

  async handleDriverResponse(rideUUID: string, driverId: string, action: 'accept' | 'reject'): Promise<{ success: boolean; message: string; acceptedDetails?: any }> {
    try {
      const ride = await this.ridesModel.findOne({ rideUUId: rideUUID }).exec();
      if (!ride) return { success: false, message: 'Ride not found' };

      if (action === 'accept') {
        // Parallelize independent DB queries
        const [driverUser, vehicle, driverDetails, passengerUser] = await Promise.all([
          this.userModel.findById(new Types.ObjectId(driverId)).exec(),
          this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId), deleted: false }).exec(),
          this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec(),
          ride.passengerId ? this.userModel.findById(ride.passengerId).exec() : Promise.resolve(null),
        ]);

        const driverName = driverUser?.fullName ?? null;
        const pickupCoords = ride.pickupLocation?.coordinates;
        const vType = (vehicle?.vehicleType as string)?.toLowerCase() || 'car';

        // Only calculate driver-to-pickup distance (needed for ETA display)
        let driverToPickupDistanceKm = 0;
        let driverToPickupDurationMinutes = 0;
        let driverLat = 0;
        let driverLng = 0;

        if (driverDetails?.geoLocation?.coordinates && pickupCoords?.[1]) {
          try {
            // GeoJSON coordinates are stored as [longitude, latitude]
            driverLng = driverDetails.geoLocation.coordinates[0];
            driverLat = driverDetails.geoLocation.coordinates[1];
            const dist = await this.distanceCalculator.calculateDriverDistance(
              pickupCoords[1], pickupCoords[0],
              driverLat, driverLng,
              vType,
            );
            driverToPickupDistanceKm = dist.distanceKm;
            driverToPickupDurationMinutes = dist.durationMinutes;
          } catch { }
        }
        this.logger.log(`Driver ${driverId} is ${driverToPickupDistanceKm} km away from pickup, ETA ${driverToPickupDurationMinutes} minutes`);
        // Use the fare already persisted to the ride document by executeExpandingRingMatch or matchScheduledDrivers
        const pickupToDropoffKm = ride.distanceInKm || 0;
        const storedFare = ride.fare;
        const totalFare = ride.estimatedFare || 0;

        const baseFare = storedFare?.baseAmount || 0;
        const distanceFare = storedFare?.distanceAmount || 0;
        const totalAmount = storedFare?.totalAmount || 0;

        const updatedRide = await this.ridesModel.findOneAndUpdate(
          { _id: ride._id, rideStatus: RideStatus.PENDING },
          {
            $set: {
              driverId: new Types.ObjectId(driverId),
              rideStatus: RideStatus.CONFIRMED,
              distanceInKm: pickupToDropoffKm,
              estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
              estimatedFare: totalFare,
              distanceToReachPassenger: driverToPickupDistanceKm,
              estimatedTimeToReachPassenger: driverToPickupDurationMinutes,
              timeToReachPassengerInMinutes: driverToPickupDurationMinutes,
              fare: {
                subTotal: totalAmount,
                baseAmount: baseFare,
                trafficCongestionAmount: 0,
                distanceAmount: Math.round(distanceFare),
                totalAmount: Math.round(totalAmount),
                noOfPassengers: ride.noOfPassengers || 1,
                discountAmount: 0,
                promoCodeId: null,
              },
            },
          },
          { new: true },
        ).exec();

        if (!updatedRide) return { success: false, message: 'Ride was already accepted by another driver' };

        // Build a fare object compatible with buildAcceptDetailsFromCache
        const rideFare: FareBreakdown = {
          baseFare: baseFare,
          total: totalAmount,
          pickupCost: 0,
          distanceCost: distanceFare,
          durationCost: 0,
        };

        // Build accept details with already-fetched data, avoiding 5 redundant DB queries
        const acceptDetails = this.buildAcceptDetailsFromCache(
          updatedRide, driverId, rideFare,
          driverUser, driverDetails, vehicle, passengerUser,
        );

        if (passengerUser) {
          const ablyChannelId = `WG-RIDE-${rideUUID}-ride-details`;
          const driverSnapshot = {
            fullName: acceptDetails?.driver?.fullName || driverName || 'Driver',
            profileImage: acceptDetails?.driver?.profileImage || null,
            rating: acceptDetails?.driver?.rating || null,
            phone: acceptDetails?.driver?.phone || driverUser?.phone || '',
          };
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
            estimatedTimeInMinutes: driverToPickupDurationMinutes || ride.estimatedTimeInMinutes || null,
            driverSnapshot,
            rideId: updatedRide._id.toString(),
            distanceToPickupKm: driverToPickupDistanceKm || null,
            passengerId: updatedRide.passengerId?.toString() || null,
          };
          this.notificationService.createNotification(notificationInput, passengerUser);
        }

        // Subscribe (or resubscribe) to the driver's location channel so live
        // location updates are tracked for the duration of the ride.
        await this.subscribeToDriverLocationChannel(driverId).then((res: any) => {
          this.logger.log(`Successfully subscribed driver ${driverId} to location channel`);
           // If driver is within 300 meters of pickup, publish their location to both the ride channel
        // and the driver's personal location channel immediately so the passenger sees the driver's
        // position right away on the map.
        if (driverToPickupDistanceKm <= 0.3) {
          // Publish to the ride channel so the passenger immediately sees the driver's position
        
          // Also publish to the driver's personal location channel so that any subscribers
          // (e.g. passenger app location tracking) immediately see the driver's initial position.
          this.rideChannelService.publishDriverLocationToChannel(driverId, {
            driverId,
            latitude: driverLat,
            longitude: driverLng,
            updatedAt: new Date().toISOString(),
          }).catch((err) => this.logger.warn(`Background driver location publish to driver channel failed: ${err}`));
        }
        }).catch((err: any) =>
          this.logger.warn(
            `Failed to subscribe driver ${driverId} location channel on accept: ${err?.message || err}`,
          ),
        );

       

        this.logger.log(`Driver ${driverId} accepted ride ${rideUUID}`);
        return { success: true, message: 'Ride accepted successfully', acceptedDetails: acceptDetails };
      } else if (action === 'reject') {
        return { success: true, message: 'Ride rejected' };
      }
    } catch (err) {
      this.logger.warn(`Failed to handle driver response: ${err}`);
      return { success: false, message: 'Failed to process driver response' };
    }
    return { success: false, message: 'Invalid action' };
  }

  /**
   * Build accept details using already-fetched DB data to avoid 5 redundant queries.
   * Used by handleDriverResponse which already has driverUser, driverDetails, vehicle, passengerUser.
   */
  private buildAcceptDetailsFromCache(
    ride: RidesDocument,
    driverId: string,
    estimatedFare: FareBreakdown | ScheduledFareBreakdown,
    driverUser: UserDocument | null,
    driverDetails: UserDetailsDocument | null,
    vehicle: VehicleDocument | null,
    passengerUser: UserDocument | null,
  ): any {
    const passengerId = ride.passengerId?.toString();
    return {
      rideId: ride._id.toString(),
      rideUUId: ride.rideUUId,
      driver: {
        driverId,
        fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver',
        phone: driverUser?.phone || '',
        profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)),
        rating: driverDetails?.rating ?? 0,
      },
      vehicle: {
        vehicleId: vehicle?._id?.toString() || '',
        vehicleModel: vehicle?.vehicleModel || '',
        vehicleType: vehicle?.vehicleType || '',
        color: vehicle?.color || '',
        numberPlate: vehicle?.numberPlate || '',
        year: vehicle?.year || 0,
      },
      passenger: passengerId ? { passengerId, fullName: passengerUser?.fullName || 'Passenger', phone: passengerUser?.phone || '' } : undefined,
      pickupLocation: {
        address: ride.pickupLocation?.address || '',
        coordinates: ride.pickupLocation?.coordinates || [0, 0],
        city: ride.pickupLocation?.city,
      },
      dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined,
      estimatedFare: estimatedFare?.total || 0,
      estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
      distanceInKm: ride.distanceInKm || 0,
      acceptedAt: new Date().toISOString(),
    };
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
          // Haversine fallback
          const R = 6371;
          const dLat = (pickupLat - latitude) * Math.PI / 180;
          const dLng = (pickupLng - longitude) * Math.PI / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(latitude * Math.PI / 180) * Math.cos(pickupLat * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distanceKm = Math.round(R * c);
          durationMinutes = Math.round(distanceKm * 2);
        }

        // Update ride document with distance/time to reach passenger
        await this.ridesModel.findByIdAndUpdate(activeRide._id, {
          $set: {
            distanceToReachPassenger: distanceKm,
            estimatedTimeToReachPassenger: durationMinutes
          },
        }).exec();

        // Publish to the ride channel
        if (distanceKm > 0.3)
          await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-moving', {
            rideId: activeRide._id.toString(),
            driverId,
            latitude,
            longitude,
            distanceToPickupKm: distanceKm,
            estimatedTimeToPickupMinutes: durationMinutes,
            message: `Driver is ${distanceKm} km away.`,
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
              distanceToPickupKm: distanceKm,
              estimatedTimeToPickupMinutes: durationMinutes,
              message: `Driver is at the ${distanceKm} km away.`,
            });
            this.notificationService.createNotification({
              title: 'Driver is arriving',
              rideId: activeRide._id.toString(),
              notificationType: NotificationType.RIDE_DETAILS,
              description: `Your driver is ${distanceKm} km away. Estimated arrival in ${durationMinutes} minutes.`,
              ablyChannelId: activeRide.ablyChannelId || `WG-RIDE-${activeRide.rideUUId}-ride-details`,
              driverName: activeRide.driverId?.toString() || '',
              pickupLocation: activeRide.pickupLocation,
              dropoffLocation: activeRide.dropoffLocation,
              distanceInKm: distanceKm,
              estimatedTimeInMinutes: durationMinutes,
              passengerSnapshot: { fullName: passenger.fullName || 'Passenger', phone: passenger.phone || '', profileImage: '', rating: 0 },
            }, passenger);
          }
        }
        if (activeRide.rideStatus === RideStatus.CONFIRMED && distanceKm <= 0.05) {
          await this.ridesModel.findByIdAndUpdate(activeRide._id, { $set: { driverArrivingNotified: true } }).exec();
          const passenger = await this.userModel.findById(activeRide.passengerId).exec();
          if (passenger) {
            await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-arrived', {
              rideId: activeRide._id.toString(),
              driverId,
              latitude,
              longitude,
              distanceToPickupKm: distanceKm,
              estimatedTimeToPickupMinutes: durationMinutes,
              message: `Driver is at the pickup location ${distanceKm} km away.`,
            });
            this.notificationService.createNotification({
              title: 'Driver is at pickup location',
              notificationType: NotificationType.RIDE_DETAILS,
              rideId: activeRide._id.toString(),
              description: `Your driver is at pickup location`,
              ablyChannelId: activeRide.ablyChannelId || `WG-RIDE-${activeRide.rideUUId}-ride-details`,
              driverName: activeRide.driverId?.toString() || '',
              pickupLocation: activeRide.pickupLocation,
              dropoffLocation: activeRide.dropoffLocation,
              distanceInKm: distanceKm,
              estimatedTimeInMinutes: durationMinutes,
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
            // Haversine fallback (same formula repeated - kept for clarity in this hot path)
            const R = 6371;
            const dLat = (dropoffLat - latitude) * Math.PI / 180;
            const dLng = (dropoffLng - longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(latitude * Math.PI / 180) * Math.cos(dropoffLat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            dropoffDistanceKm = Math.round(R * c);
            dropoffDurationMinutes = Math.round(dropoffDistanceKm * 2);
          }

          // Update ride document with remaining distance/time to destination
          await this.ridesModel.findByIdAndUpdate(activeRide._id, {
            $set: {
              distanceInKm: dropoffDistanceKm,
              estimatedTimeInMinutes: dropoffDurationMinutes,
            },
          }).exec();

          if (dropoffDistanceKm > 0.05 && !activeRide.driverArrivedAtDestinationNotified)
            await this.rideChannelService.publishRideEvent(activeRide.rideUUId, 'driver-moving-destination', {
              rideId: activeRide._id.toString(),
              driverId,
              latitude,
              longitude,
              distanceToDropoffKm: dropoffDistanceKm,
              dropoffDurationMinutes: dropoffDurationMinutes,
              message: `Driver is ${dropoffDistanceKm} km away.`,
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
                distanceToDropoffKm: dropoffDistanceKm,
                dropoffDurationMinutes: dropoffDurationMinutes,
                message: `Driver has arrived at the destination.`,
              });
              this.notificationService.createNotification({
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
   */
  async subscribeToDriverLocationChannel(driverId: string): Promise<boolean> {
    if (this.driverLocationSubscriptions.has(driverId)) {
      this.logger.warn(`Driver ${driverId} already subscribed to location channel. Re-subscribing.`);
      this.unsubscribeFromDriverLocationChannel(driverId);
    }

    const unsubscribe = this.rideChannelService.subscribeToDriverLocationChannel(
      driverId,
      async (data: any) => {
        const { driverId: dId, lat, lng } = data;
        if (!dId || lat == null || lng == null) return;

        const driverObjectId = new Types.ObjectId(dId);

        // Update geo-location AND the last-location-update timestamp in DB.
        // The timestamp is used by the background sweep job to detect drivers
        // that haven't sent a location update within the configured timeout.
        await this.userDetailsModel.findOneAndUpdate(
          { userId: driverObjectId, deleted: false },
          { $set: { geoLocation: { type: 'Point', coordinates: [lat, lng] }, lastLocationUpdateAt: new Date() } },
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

  /**
   * Background sweep (cron) that marks drivers OFFLINE when they have not
   * published a location update within the configured timeout (default 15 min).
   *
   * This is the safety-net for the location listener: if the driver app crashes,
   * loses network, or otherwise stops publishing location updates, the driver
   * would remain stuck in the ONLINE state and keep being matched for rides they
   * can never physically reach.
   *
   * Runs on the schedule defined by MATCHMAKING_CONFIG.STALE_DRIVER_CHECK_CRON.
   * NOTE: The scheduled execution lives in the dedicated `cron` app
   * (apps/cron/src/modules/cron/cron.service.ts). This method is kept here only
   * to support the manual `markStaleDriversOffline` GraphQL trigger.
   */
  async cleanupStaleOfflineDrivers(): Promise<{ processed: number; markedOffline: number; errors: number }> {
    const timeoutMinutes = MATCHMAKING_CONFIG.LOCATION_UPDATE_TIMEOUT_MINUTES;
    const staleThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000);
    this.logger.log(`Sweeping stale online drivers (lastLocationUpdateAt before ${staleThreshold.toISOString()})`);

    let processed = 0;
    let markedOffline = 0;
    let errors = 0;

    try {
      // Find ONLINE drivers whose last location update is stale (or was never received).
      // `lastLocationUpdateAt` is seeded when the driver goes online and refreshed on
      // every location update the matchmaking service receives via the location listener.
      const staleDrivers = await this.userDetailsModel
        .find({
          driverOnlineStatus: DriverOnlineStatus.ONLINE,
          deleted: false,
          $or: [
            { lastLocationUpdateAt: { $exists: false } },
            { lastLocationUpdateAt: { $lte: staleThreshold } },
          ],
        })
        .exec();

      this.logger.log(`Found ${staleDrivers.length} online drivers with stale location`);

      for (const driverDetails of staleDrivers) {
        processed++;
        const driverId = driverDetails.userId.toString();
        const driverObjectId = new Types.ObjectId(driverDetails.userId);

        try {
          // Don't force-offline a driver who is in the middle of an active ride —
          // that would disrupt pickup/ongoing-ride logic that relies on the driver
          // remaining online. They will be re-evaluated on the next sweep once
          // their ride completes or is cancelled.
          const activeRide = await this.ridesModel
            .findOne({
              driverId: driverObjectId,
              rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
              deleted: false,
            })
            .exec();

          if (activeRide) {
            this.logger.log(`Skipping offline-mark for driver ${driverId}: active ride ${activeRide.rideUUId} in progress`);
            continue;
          }

          // Mark the driver offline and clear the location-update timestamp so a
          // fresh 15-min window starts the next time they go online.
          await this.userDetailsModel
            .findOneAndUpdate(
              { userId: driverObjectId, deleted: false },
              { $set: { driverOnlineStatus: DriverOnlineStatus.OFFLINE, lastLocationUpdateAt: null } },
            )
            .exec();

          // Stop listening to the driver's personal location channel on this service
          // instance so we don't keep processing phantom location updates.
          await this.unsubscribeFromDriverLocationChannel(driverId);

          // Reconcile the daily online-status accounting so the driver's
          // totalOnlineSeconds stays accurate (mirrors the logout flow in the api).
          await this.finalizeDailyOnlineStatus(driverId);

          markedOffline++;
          this.logger.log(`Marked driver ${driverId} offline: no location update for ${timeoutMinutes} min`);
        } catch (err: any) {
          errors++;
          this.logger.error(`Failed to mark driver ${driverId} offline: ${err?.message || err}`);
        }
      }

      this.logger.log(`Stale driver sweep complete: processed=${processed}, markedOffline=${markedOffline}, errors=${errors}`);
    } catch (err: any) {
      this.logger.error(`Fatal error during stale driver sweep: ${err?.message || err}`);
    }

    return { processed, markedOffline, errors };
  }

  /**
   * Manually trigger the stale-driver sweep. Exposed as a GraphQL mutation so
   * operators can run it on demand (e.g. for testing). Also invoked by the cron.
   */
  async markStaleDriversOffline(): Promise<{ processed: number; markedOffline: number; errors: number }> {
    return this.cleanupStaleOfflineDrivers();
  }

  /**
   * When a driver is force-marked offline (no location updates), reconcile the
   * daily online-status record: fold the elapsed online time into
   * totalOnlineSeconds and clear lastOnlineAt. This mirrors the logout logic in
   * the api's UserDetailsService.setOnlineStatus.
   */
  private async finalizeDailyOnlineStatus(driverId: string): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const record = await this.userDailyOnlineStatusModel
        .findOne({ userId: new Types.ObjectId(driverId), date: today })
        .exec();

      if (record && record.lastOnlineAt) {
        const elapsedSeconds = Math.floor((Date.now() - record.lastOnlineAt.getTime()) / 1000);
        if (elapsedSeconds > 0) {
          await this.userDailyOnlineStatusModel
            .updateOne(
              { _id: record._id },
              { $inc: { totalOnlineSeconds: elapsedSeconds }, $set: { lastOnlineAt: null } },
            )
            .exec();
        } else {
          await this.userDailyOnlineStatusModel
            .updateOne({ _id: record._id }, { $set: { lastOnlineAt: null } })
            .exec();
        }
      }
    } catch (err: any) {
      // Non-fatal: online-time accounting is best-effort.
      this.logger.warn(`Failed to reconcile daily online status for driver ${driverId}: ${err?.message || err}`);
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
          description: `Your driver has arrived at pickup location. Remaining distance: ${remainingDistanceKm.toFixed(2)} km. Estimated time: ${updatedRide.estimatedTimeInMinutes.toFixed(2) || 0} minutes.`,
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
      rideCompletedAt?: string;
      walletAmount?: number;
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
      const rideStartedAt = ride.rideStartedAt?.getTime() || 0;
      const rideEndedAt = Date.now();

      const actualCompleteDurationInMinutes = Math.floor((rideEndedAt - rideStartedAt) / (1000 * 60));

      // Fare calculation
      const baseFare = (MATCHMAKING_CONFIG.FARE.BASE_PICKUP_COST[vehicle?.vehicleType] || 0) as number;
      const perKmRate = (MATCHMAKING_CONFIG.FARE.PER_KM_RATE[vehicle?.vehicleType] || 0) as number;

      const baseFareAmount = ride.fare?.baseAmount || baseFare;
      const distanceFare = Number(ride.fare?.distanceAmount || (distanceInKm * perKmRate));
      const totalFare = ride.fare?.totalAmount || Number(Number(baseFareAmount) + Number(distanceFare));

      const discountAmount = Math.round(Number(ride.paymentDetails?.discountAmount || 0));
      const finalAmount = Math.max(0, Math.round(Number(Number(totalFare) - Number(discountAmount))));

      const commissionRate = Number(ride.paymentDetails?.driverCommission) || 0.2;

      const existingFare: any = ride.fare || {};

      const updatedRide = await this.ridesModel.findByIdAndUpdate(
        ride._id,
        {
          $set: {
            rideEndedAt: new Date(),
            distanceInKm,
            estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0,
            actualCompletedDurationInMinutes: actualCompleteDurationInMinutes,
            estimatedFare: totalFare,
            fare: {
              baseAmount: baseFareAmount,
              distanceAmount: distanceFare,
              totalAmount: finalAmount,
              noOfPassengers: ride.noOfPassengers || 1,
              driverCommission: commissionRate,
              discountAmount: existingFare.discountAmount || 0,
              promoCodeId: existingFare.promoCodeId || null,
              promoCodeName: existingFare.promoCodeName || null,
              subTotal: existingFare.subTotal || 0,
            },
            paymentDetails: {
              ...(ride.paymentDetails ? (ride.paymentDetails as any).toObject ? (ride.paymentDetails as any).toObject() : ride.paymentDetails : {}),
              totalAmount: finalAmount,
              baseAmount: baseFareAmount,
              distanceAmount: distanceFare,
            },
          },
        },
        { new: true },
      ).exec();

      if (!updatedRide) {
        return { success: false, message: 'Failed to update ride to completed' };
      }

      const totalDurationMinutes = actualCompleteDurationInMinutes;
      const distanceCharge = distanceFare.toFixed(2);
      const hrs = Math.floor(totalDurationMinutes / 60);
      const mins = totalDurationMinutes % 60;
      const durationStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

      await this.rideChannelService.publishRideCompleted(updatedRide.rideUUId, {
        rideId: updatedRide._id.toString(),
        rideUUId: updatedRide.rideUUId,
        rideStatus: updatedRide.rideStatus,
        totalDurationInMinutes: totalDurationMinutes,
        totalDuration: durationStr,
        fareBreakdown: { baseFare: Number(baseFareAmount), distanceCharge: Number(distanceCharge), discount: Number(discountAmount), totalFare: Number(finalAmount), subTotal: Number(existingFare.subTotal || 0), promocodeName: existingFare.promoCodeName || null },
        completedAt: updatedRide.rideEndedAt.toISOString(),
      });

      const passenger = await this.userModel.findById(updatedRide.passengerId).exec();
      if (passenger) {
        await this.notificationService.createNotification({
          title: 'Ride completed',
          notificationType: NotificationType.RIDE_COMPLETE_NOTIFICATION,
          description: `Ride completed. Duration: ${durationStr}. Fare: Rs.${finalAmount}`,
          ablyChannelId: updatedRide.ablyChannelId || `WG-RIDE-${updatedRide.rideUUId}-ride-details`,
          pickupLocation: updatedRide.pickupLocation,
          dropoffLocation: updatedRide.dropoffLocation,
          distanceInKm,
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
          rideStatus: updatedRide.rideStatus,
          totalDurationInMinutes: totalDurationMinutes,
          totalDuration: durationStr,
          fareBreakdown: { baseFare: Number(baseFareAmount), distanceCharge: Number(distanceCharge), discount: Number(discountAmount), totalFare: Number(finalAmount) },
          completedAt: updatedRide.rideEndedAt.toISOString(),
          rideCompletedAt: updatedRide.rideEndedAt.toISOString(),
          walletAmount: updatedRide.passengerId
            ? await this.walletService.getBalance(driverId)
            : 0,
        },
      };
    } catch (err: any) {
      this.logger.error('Failed to complete ride: ' + (err?.message || err));
      return { success: false, message: 'Failed to complete ride' };
    }
  }

  async cancelInstantRide(rideId: string, passengerId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Passenger ${passengerId} cancelling instant ride ${rideId}`);
    try {
      const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
      if (!ride) {
        this.logger.log(`Ride ${rideId} not found during cancellation - it was already deleted/cancelled. Treating as successful cancellation.`);
        return { success: true, message: 'Ride was cancelled by user' };
      }

      if (ride.passengerId.toString() !== passengerId) {
        return { success: false, message: 'You are not the owner of this ride' };
      }

      if (ride.rideType !== RideTypes.INSTANT) {
        return { success: false, message: 'Only instant rides can be cancelled via this endpoint' };
      }

      // Check if ride is in a state that can be cancelled (PENDING or CONFIRMED)
      if (ride.rideStatus !== RideStatus.PENDING && ride.rideStatus !== RideStatus.CONFIRMED) {
        return { success: false, message: `Cannot cancel ride in ${ride.rideStatus} status` };
      }

      const rideUUId = ride.rideUUId;
      const driverId = ride.driverId?.toString();

      // STEP 1: Set ride status to CANCELLED immediately.
      // This signals the running executeExpandingRingMatch loop to break out
      // (the loop checks ride.rideStatus !== RideStatus.PENDING at each attempt).
      await this.ridesModel.findByIdAndUpdate(ride._id, { $set: { rideStatus: RideStatus.CANCELLED } }).exec();

      // STEP 2: Publish a ride-cancelled event on the Ably channel.
      // The subscribeForDriverResponse handler will detect this event and
      // immediately resolve the driver response promise, stopping the matchmaking loop.
      await this.rideChannelService.publishRideEvent(rideUUId, 'ride-cancelled', {
        rideId: ride._id.toString(),
        rideUUId,
        cancelled: true,
        cancelledBy: passengerId,
        cancelledAt: new Date().toISOString(),
        message: 'Passenger has cancelled the ride',
      });

      // STEP 3: If driver already accepted (CONFIRMED status), send notification to driver
      if (driverId && ride.rideStatus === RideStatus.CONFIRMED) {
        this.logger.log(`Ride ${rideUUId} was accepted by driver ${driverId}. Notifying driver about cancellation.`);
        const driverUser = await this.userModel.findById(new Types.ObjectId(driverId)).exec();
        if (driverUser) {
          await this.notificationService.createNotification({
            title: 'Ride Cancelled',
            notificationType: NotificationType.RIDE_DETAILS,
            description: 'The passenger has cancelled the ride request.',
            ablyChannelId: ride.ablyChannelId || `WG-RIDE-${rideUUId}-ride-details`,
            rideId: ride._id.toString(),
            cancelled: true,
            passengerId,
          } as any, driverUser);
        }
      }

      // STEP 4: Force-resolve any pending subscribeForDriverResponse promise immediately.
      // This is the most reliable way to stop the matchmaking loop - it bypasses Ably
      // event echo limitations and directly resolves the waiting promise.
      const pendingResolver = this.pendingDriverResponseResolvers.get(rideUUId);
      if (pendingResolver) {
        this.logger.log(`Force-resolving pending driver response promise for ride ${rideUUId}`);
        this.pendingDriverResponseResolvers.delete(rideUUId);
        pendingResolver({ accepted: false, rejectedDriverIds: [] });
      }

      // STEP 5: Delete the ride document
      await this.ridesModel.findByIdAndDelete(ride._id).exec();

      // NOTE: We do NOT release the Ably channel here because the running
      // executeExpandingRingMatch loop may still be subscribed to it via
      // subscribeForDriverResponse. Releasing the channel (detaching it)
      // would remove the subscription, causing the waiting promise to miss
      // the 'ride-cancelled' event and wait for the full timeout (20s).
      // Instead, the matchmaking loop will detect the CANCELLED status via
      // the pre-subscribe DB check on the next attempt and return early.
      // The channel will be cleaned up naturally when the ride document is
      // gone and no further references exist.

      this.logger.log(`Ride ${rideUUId} cancelled successfully by passenger ${passengerId}`);
      return { success: true, message: 'Ride cancelled successfully' };
    } catch (err: any) {
      this.logger.error(`Failed to cancel ride: ${err?.message || err}`);
      return { success: false, message: 'Failed to cancel ride' };
    }
  }

  async acknowledgeAndFinishRide(rideId: string, driverId: string): Promise<{ success: boolean; acknowledged: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} acknowledging and finishing ride ${rideId}`);
    try {
      const ride = await this.ridesModel.findById(new Types.ObjectId(rideId)).exec();
      if (!ride) {
        return { success: false, message: 'Ride not found', acknowledged: false };
      }

      if (ride.driverId?.toString() !== driverId) {
        return { success: false, message: 'You are not the assigned driver for this ride', acknowledged: false };
      }

      if (!ride.rideEndedAt || ride?.paymentDetails?.paymentStatus !== PaymentStatusEnum.PAID) {
        return { success: false, message: `Ride must be ended and payment should be confirmed to acknowledge and finish. Current: ${ride.rideStatus} ${ride?.paymentDetails?.paymentStatus}`, acknowledged: false };
      }
      if (ride.isAcknowledgeByDriver) {
        return { success: false, message: 'Ride has already been acknowledged by driver', acknowledged: true };
      }

      // Fetch driver details from both User and UserDetails for optimized snapshot
      const [driverUser, driverDetails] = await Promise.all([
        this.userModel.findById(new Types.ObjectId(driverId)).exec(),
        this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec(),
      ]);

      const driverSnapshot = {
        fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver',
        phone: driverUser?.phone || '',
        rating: driverDetails?.rating ?? 0,
        profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)),
      };

      // Update ride with isAcknowledgeByDriver set to true
      const updatedRide = await this.ridesModel.findByIdAndUpdate(
        ride._id,
        {
          $set: {
            isAcknowledgeByDriver: true,
            rideStatus: RideStatus.COMPLETED,
            rideCompletedAt: new Date(),
          },
        },
        { new: true },
      ).exec();

      if (!updatedRide) {
        return { success: false, message: 'Failed to update ride', acknowledged: false };
      }

      // Send notification to passenger with only driverSnapshot
      const passenger = await this.userModel.findById(updatedRide.passengerId).exec();
      if (passenger) {
        await this.notificationService.createNotification({
          title: 'Payment Confirmed',
          notificationType: NotificationType.RIDE_COMPLETE_NOTIFICATION,
          description: `Your ride payment was confirmed successfully by ${driverSnapshot.fullName}`,
          ablyChannelId: updatedRide.ablyChannelId || `WG-RIDE-${updatedRide.rideUUId}-ride-details`,
          rideId: updatedRide._id.toString(),
          driverSnapshot,
        }, passenger);
      }

      // Publish to Ably channel with driverSnapshot
      await this.rideChannelService.publishRideEvent(updatedRide.rideUUId, 'driver-acknowledged', {
        rideId: updatedRide._id.toString(),
        rideUUId: updatedRide.rideUUId,
        driverAcknowledged: true,
        driverId,
        driverSnapshot,
        rideStatus: RideStatus.COMPLETED,
        completedAt: new Date().toISOString(),
      });

      // Release the channel
      this.rideChannelService.releaseRideChannel(updatedRide.rideUUId);

      this.logger.log(`Ride ${rideId} acknowledged and finished by driver ${driverId}`);
      return { success: true, acknowledged: true, message: 'acknowledged the payment successfully' };
    } catch (err: any) {
      this.logger.error(`Failed to acknowledge and finish ride: ${err?.message || err}`);
      return { success: false, acknowledged: false, message: 'Failed to acknowledge and finish ride' };
    }
  }

  async getVehicleEstimates(params: {
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    noOfPassengers: number;
    promoCodeId?: string;
    passengerId?: string;
  }): Promise<VehicleEstimateGraphQL[]> {
    let vehicleTypes = [VehicleType.CAR, VehicleType.MOTORBIKE, VehicleType.SCOOTER];
    if (params.noOfPassengers > 1) vehicleTypes = [VehicleType.CAR];

    // Resolve the promo code once (shared across all vehicle types) so we can
    // re-use the same validation result, usage counts, and discount amounts.
    // When a promo code is provided but invalid, we still capture its actual
    // id/name and a human-readable message to return to the client.
    let promo: PromoCodeDocument | null = null;
    let promoCodeMessage: string | undefined;
    let promoCodeName: string | undefined;
    let promoCodeIdValue: string | undefined;
    if (params.promoCodeId) {
      const promoResult = await this.loadAndValidatePromoCode(params.promoCodeId, params.passengerId);
      // A promo only contributes a discount when there's no validation reason.
      promo = promoResult.reason ? null : promoResult.promo;
      promoCodeMessage = promoResult.reason;
      promoCodeIdValue = params.promoCodeId;
      if (promoResult.promo) {
        promoCodeName = promoResult.promo.name;
      }
    }

    // Calculate the pickup→dropoff route ONCE, before looping over vehicle types.
    // The route between two fixed coordinates is identical regardless of vehicle
    // type, so computing it inside the Promise.all would redundantly invoke the
    // Baato API once per vehicle type. The result drives the FARE calculation
    // below for every vehicle type.
    let routeDistanceKm = 0;
    let routeDurationMinutes = 0;
    try {
      const route = await this.distanceCalculator.calculateDistance(params.pickupLat, params.pickupLng, params.dropoffLat, params.dropoffLng, VehicleType.CAR.toLowerCase());
      routeDistanceKm = route.distanceKm;
      routeDurationMinutes = route.durationMinutes;
    } catch (err: any) {
      this.logger.warn(`getVehicleEstimates: Baato pickup-to-dropoff distance failed, using default fallback (${routeDistanceKm} km): ${err?.message || err}`);
    }

    const estimates = await Promise.all(vehicleTypes.map(async (type): Promise<VehicleEstimateGraphQL | null> => {
      try {
        // Find nearest available driver for this vehicle type.
        // The driver-to-pickup distance and ETA drive the returned distance/time
        // fields. No pickup→dropoff route calculation is needed here because
        // the route was already calculated once above (outside the Promise.all).
        const nearestDriver = await this.findNearestDriverDistance(
          params.pickupLat,
          params.pickupLng,
          type as VehicleType,
        );
        // If no active/available driver exists for this vehicle type, skip it
        // so the client doesn't show an estimate for an unavailable service.
        if (!nearestDriver) {
          this.logger.log(`No available driver for vehicle type ${type}; skipping estimate`);
          return null;
        }
        this.logger.log(`Nearest driver for ${type}: distance: ${nearestDriver.distanceKm} km, ETA: ${nearestDriver.durationMinutes} min`);
        const driverDistanceToPickupKm = nearestDriver.distanceKm;
        const driverEtaMinutes = nearestDriver.durationMinutes;

        // Fallback defaults so a meaningful fare is produced even when no driver
        // is currently available (mirrors the pattern used elsewhere in this file).
        const effectiveDurationMinutes = driverEtaMinutes;

        // Use the pre-calculated pickup→dropoff route for the FARE.
        // (distanceKm and estimatedTimeInMinutes returned below still reflect the
        // nearest driver's distance/ETA to the pickup location.)
        const fare = this.pricingService.calculateFare({ distanceKm: routeDistanceKm, durationMinutes: routeDurationMinutes, vehicleType: type as VehicleType });
        const originalFare = Math.round(fare.total);

        let comfortType = ''; let hasAC: boolean | undefined = undefined;
        if (type === VehicleType.CAR) { comfortType = 'Comfortable city ride with fast pickup'; hasAC = true; } else if (type === VehicleType.MOTORBIKE) { comfortType = 'Affordable and quick'; hasAC = false; } else if (type === VehicleType.SCOOTER) { comfortType = 'Short and quick ride'; hasAC = false; }

        // Apply promo discount if the promo code is valid for this fare.
        const discountInfo = this.applyPromoDiscountToFare(promo, originalFare);

        // If the promo code is valid but its minimum-fare condition wasn't met,
        // surface a human-readable message so the client knows why no discount was applied.
        let effectivePromoCodeMessage = promoCodeMessage;
        if (!discountInfo && promo && !promoCodeMessage) {
          if (Number(promo.minimumFare) > 0 && originalFare < Number(promo.minimumFare)) {
            effectivePromoCodeMessage = `Promo code '${promo.name}' requires a minimum fare of Rs. ${promo.minimumFare}`;
          }
        }

        return {
          vehicleType: type as VehicleType,
          estimatedFare: Math.round(originalFare - (discountInfo?.discountAmount || 0)),
          originalFare,
          discountAmount: discountInfo?.discountAmount || 0,
          promoCodeName: discountInfo?.promoCodeName || (effectivePromoCodeMessage ? promoCodeName : undefined),
          promoCodeId: discountInfo?.promoCodeId ? discountInfo.promoCodeId.toString() : (promoCodeIdValue || undefined),
          promoCodeMessage: effectivePromoCodeMessage,
          distanceKm: routeDistanceKm,
          driverDistanceToPickupKm,
          estimatedTimeInMinutes: effectiveDurationMinutes,
          comfortType,
          hasAC,
          noOfPassengers: params.noOfPassengers,
        };
      } catch (err: any) {
        this.logger.error(`Failed to calculate vehicle estimate for type ${type}: ${err?.message || err}${err.response ? `, response: ${JSON.stringify(err.response)}` : ''}`);
        return null;
      }
    }));
    // Exclude vehicle types that have no available driver (or where estimation failed)
    return estimates.filter((estimate): estimate is VehicleEstimateGraphQL => estimate !== null);
  }

  /**
   * Load and validate a promo code against all its conditions.
   * Returns the promo document (even when invalid) along with a human-readable
   * reason when validation fails, so the caller can surface the actual promo
   * code id/name and a message to the client when it is not valid.
   */
  private async loadAndValidatePromoCode(
    promoCodeId: string,
    passengerId?: string,
  ): Promise<{ promo: PromoCodeDocument | null; reason?: string }> {
    try {
      const promo = await this.promoCodeModel.findById(toMongoId(promoCodeId)).exec();
      if (!promo) {
        return { promo: null, reason: `Promo code '${promoCodeId}' not found` };
      }

      const now = new Date();
      if (
        promo.status === PromoCodeStatusEnum.EXPIRED ||
        promo.expiryDateTime < now ||
        promo.startDateTime > now ||
        promo.status !== PromoCodeStatusEnum.ACTIVE
      ) {
        this.logger.warn(`Promo code ${promo.name} is not in a valid time/status window for estimates`);
        return { promo, reason: `Promo code '${promo.name}' is expired or not active` };
      }

      if (promo.appliedTo !== AppliedToEnum.ALL_RIDES && promo.appliedTo !== AppliedToEnum.INSTANT) {
        this.logger.warn(`Promo code ${promo.name} is not applicable to INSTANT rides`);
        return { promo, reason: `Promo code '${promo.name}' is not applicable to instant rides` };
      }

      if (!passengerId) {
        // Without a passenger, we can't check usage limits. Allow static conditions only.
        return { promo };
      }

      const [totalUsage, userUsage] = await Promise.all([
        this.promoCodeUsedModel.countDocuments({ promoCodeId: promo._id }).exec(),
        this.promoCodeUsedModel.countDocuments({ userId: toMongoId(passengerId), promoCodeId: promo._id }).exec(),
      ]);

      if (totalUsage >= promo.totalUsageLimit) {
        this.logger.warn(`Promo code ${promo.name} has reached total usage limit`);
        return { promo, reason: `Promo code '${promo.name}' has reached its usage limit` };
      }
      if (userUsage >= promo.perUserLimit) {
        this.logger.warn(`Promo code ${promo.name} has reached per-user limit for ${passengerId}`);
        return { promo, reason: `Promo code '${promo.name}' usage limit reached for this user` };
      }

      return { promo };
    } catch (err: any) {
      this.logger.warn(`Failed to validate promo code for estimates: ${err?.message || err}`);
      return { promo: null, reason: 'Failed to validate promo code' };
    }
  }

  /**
   * Calculate the discount for a given original fare using a validated promo code.
   * Also enforces the minimum-fare condition per vehicle type.
   * Returns null when the promo code is invalid or conditions aren't met.
   */
  private applyPromoDiscountToFare(
    promo: PromoCodeDocument | null,
    originalFare: number,
  ): { discountAmount: number; promoCodeName?: string; promoCodeId?: Types.ObjectId } | null {
    if (!promo) return null;

    if (Number(promo.minimumFare) > 0 && originalFare < Number(promo.minimumFare)) {
      this.logger.warn(`Promo code ${promo.name} minimum fare not met: ${originalFare} < ${promo.minimumFare}`);
      return null;
    }

    let discount = 0;
    if (promo.discountType === DiscountTypeEnum.PERCENTAGE) {
      discount = Math.round(originalFare * ((Number(promo.percentageAmount) || 0) / 100));
      if (promo.maxDiscount && discount > Number(promo.maxDiscount)) {
        discount = Math.round(Number(promo.maxDiscount));
      }
    } else if (promo.discountType === DiscountTypeEnum.FLAT) {
      discount = Math.round(Number(promo.flatAmount) || 0);
      if (discount > originalFare) {
        discount = originalFare;
      }
    }

    return {
      discountAmount: Math.max(0, discount),
      promoCodeName: promo.name,
      promoCodeId: promo._id,
    };
  }

  /**
   * Find the nearest available (online, verified, non-busy) driver of the requested
   * vehicle type and return the distance from pickup (km) plus the ETA (minutes).
   * Returns null if no driver is found.
   */
  private async findNearestDriverDistance(
    pickupLat: number,
    pickupLng: number,
    vehicleType: VehicleType,
  ): Promise<{ distanceKm: number; durationMinutes: number } | null> {
    try {
      const vehicles = await this.vehicleModel
        .find({ vehicleType: vehicleType as VehicleType, deleted: false })
        .populate('driverId')
        .limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING)
        .exec();
      this.logger.warn(`Found ${vehicles.length} vehicles of type ${vehicleType} for nearest-driver search`);
      const validVehicles = vehicles.filter((v) => v.driverId && (v.driverId as any as UserDocument)._id);
      this.logger.warn(`Filtered to ${validVehicles.length} valid vehicles of type ${vehicleType} with associated drivers`);
      if (validVehicles.length === 0) return null;

      const driverIds = validVehicles.map((v) => (v.driverId as any as UserDocument)._id).filter(Boolean);
      const userDetailsDocs = await this.userDetailsModel
        .find({ userId: { $in: driverIds }, driverOnlineStatus: DriverOnlineStatus.ONLINE, deleted: {$ne: true} })
        .exec();
      this.logger.warn(`Found ${userDetailsDocs.length} online driver details for vehicle type ${vehicleType}`);
      const onlineMap = new Map<string, UserDetailsDocument>();
      for (const ud of userDetailsDocs) onlineMap.set(ud.userId.toString(), ud);
      if (onlineMap.size === 0) return null;

      const onlineDriverIds = [...onlineMap.keys()].map((id) => new Types.ObjectId(id));
      this.logger.log(`Found ${onlineDriverIds.length} online drivers for vehicle type ${vehicleType}`);
      const activeRides = await this.ridesModel.find({
        driverId: { $in: onlineDriverIds },
        rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
      }).exec();
      const activeRideDriverIdSet = new Set(activeRides.map((r) => r.driverId.toString()));

      let nearest: { distanceKm: number; durationMinutes: number } | null = null;
      for (const v of validVehicles) {
        const driver = v.driverId as any as UserDocument;
        if (!driver?._id) continue;
        const did = driver._id.toString();
        const ud = onlineMap.get(did);
        if (!ud) continue;
        if (activeRideDriverIdSet.has(did)) continue;
        if (driver.suspended || !driver.verified) continue;
        if (driver.loginAs !== roles.RIDER) continue;

        const coords = ud.geoLocation?.coordinates;
        if (!coords || coords.length < 2) continue;
        // GeoJSON: [lat, lng]
        const driverLat = coords[0];
        const driverLng = coords[1];
        const dist = await this.distanceCalculator.calculateDriverDistance(
           driverLat,driverLng,pickupLat, pickupLng,vehicleType.toLowerCase(),
        );
        this.logger.log("driver id", driver._id, "distanceKm", dist.distanceKm, "durationMinutes", dist.durationMinutes);
        if (!nearest || dist.distanceKm < nearest.distanceKm) {
          this.logger.log("nearest driver id", driver._id, "distanceKm", dist.distanceKm, "durationMinutes", dist.durationMinutes);
          nearest = {
            distanceKm: dist.distanceKm,
            durationMinutes: dist.durationMinutes,
          };
        }
      }

      if (!nearest) return null;
      this.logger.log(`Nearest driver for ${vehicleType}: distance: ${nearest.distanceKm} km, ETA: ${nearest.durationMinutes} min`);
      return {
        distanceKm: Math.round(nearest.distanceKm * 100) / 100,
        durationMinutes: Math.round(nearest.durationMinutes),
      };
    } catch (err: any) {
      this.logger.warn(`findNearestDriverDistance failed for ${vehicleType}: ${err?.message || err}`);
      return null;
    }
  }

  async cancelRideNotification(rideId: string, userId: string, userRole: string): Promise<{ success: boolean; message: string }> {
    try {
      const ride = await this.ridesModel.findById(toMongoId(rideId)).exec();
      if (!ride) {
        return { success: false, message: 'Ride not found' };
      }

      const user = await this.userModel.findById(toMongoId(userId)).exec();
      const userDetails = await this.userDetailsModel.findOne({ userId: toMongoId(userId) }).exec();
      const userSnapShot = {
        fullName: userDetails?.fullName || user?.fullName || 'Driver',
        phone: user?.phone || '',
        rating: userDetails?.rating ?? 0,
        profileImage: getActiveProfileImageUrl(userDetails?.profileImages, (key) => this.s3.getPublicUrl(key)),
      }
      await this.rideChannelService.publishRideEvent(ride.rideUUId, 'ride-cancelled', {
        rideId: rideId,
        rideUUId: ride.rideUUId,
        cancelled: true,
        rideStatus: RideStatus.CANCELLED,
        userId: userId,
        userSnapshot: userSnapShot,
        cancelledAt: ride.cancellationDetail?.cancelledAt || new Date().toISOString(),
        message: `Ride has been cancelled by ${userSnapShot.fullName}`,
      });

      if (userRole === roles.USER) {
        const passenger = await this.userModel.findById(ride.passengerId).exec();

        await this.notificationService.createNotification({
          title: `Ride has been cancelled`,
          notificationType: NotificationType.RIDE_CANCELLATION,
          description: `Ride has been cancelled by ${userSnapShot.fullName}`,
          rideId: rideId,
          ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
          driverSnapshot: userSnapShot
        }, passenger);
      } else {
        const driver = await this.userModel.findById(ride.passengerId).exec();
        await this.notificationService.createNotification({
          title: `Ride has been cancelled`,
          notificationType: NotificationType.RIDE_CANCELLATION,
          description: `Ride has been cancelled by ${userSnapShot.fullName}`,
          rideId: rideId,
          ablyChannelId: ride.ablyChannelId || `WG-RIDE-${ride.rideUUId}-ride-details`,
          passengerSnapshot: userSnapShot,
        }, driver);
      }
      await this
      return { success: false, message: 'Send notification and ably to ride successfully' };
    } catch (err: any) {
      this.logger.error(`Failed to send notification and ably to  ride: ${err?.message || err}`);
      return { success: false, message: 'Failed to send notification and ably to ride' };
    }

  }
  // Legacy builder methods kept for backward compatibility with matchDrivers/matchScheduledDrivers flows:
  private async buildAcceptDetails(ride: RidesDocument, driverId: string, estimatedFare: FareBreakdown): Promise<any> {
    const [driverUser, driverDetails, vehicle, passengerUser] = await Promise.all([
      this.userModel.findById(new Types.ObjectId(driverId)).exec(),
      this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec(),
      this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec(),
      this.userModel.findById(ride.passengerId).exec(),
    ]);
    const passengerDetails = await this.userDetailsModel.findOne({ userId: ride.passengerId }).exec();
    return { rideId: ride._id.toString(), rideUUId: ride.rideUUId, driver: { driverId, fullName: driverDetails?.fullName || driverUser?.fullName || 'Driver', phone: driverUser?.phone || '', profileImage: getActiveProfileImageUrl(driverDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), rating: driverDetails?.rating ?? 0 }, vehicle: { vehicleId: vehicle?._id?.toString() || '', vehicleModel: vehicle?.vehicleModel || '', vehicleType: vehicle?.vehicleType || '', color: vehicle?.color || '', numberPlate: vehicle?.numberPlate || '', year: vehicle?.year || 0 }, passenger: { passengerId: ride.passengerId.toString(), fullName: passengerDetails?.fullName || passengerUser?.fullName || 'Passenger', phone: passengerUser?.phone || '', profileImage: getActiveProfileImageUrl(passengerDetails?.profileImages, (key) => this.s3.getPublicUrl(key)), gender: passengerDetails?.gender }, pickupLocation: { address: ride.pickupLocation?.address || '', coordinates: ride.pickupLocation?.coordinates || [0, 0], city: ride.pickupLocation?.city }, dropoffLocation: ride.dropoffLocation ? { address: ride.dropoffLocation.address, coordinates: ride.dropoffLocation.coordinates, city: ride.dropoffLocation.city } : undefined, estimatedFare: estimatedFare?.total || 0, estimatedTimeInMinutes: ride.estimatedTimeInMinutes || 0, distanceInKm: ride.distanceInKm || 0, acceptedAt: new Date().toISOString() };
  }

  private async buildScheduledAcceptDetails(ride: RidesDocument, driverId: string, estimatedFare: ScheduledFareBreakdown): Promise<any> {
    const [driverUser, driverDetails, vehicle, passengerUser] = await Promise.all([
      this.userModel.findById(new Types.ObjectId(driverId)).exec(),
      this.userDetailsModel.findOne({ userId: new Types.ObjectId(driverId) }).exec(),
      this.vehicleModel.findOne({ driverId: new Types.ObjectId(driverId) }).exec(),
      this.userModel.findById(ride.passengerId).exec(),
    ]);
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