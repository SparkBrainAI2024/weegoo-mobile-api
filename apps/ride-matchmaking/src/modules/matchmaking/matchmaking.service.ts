import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { User, UserDocument } from '@libs/data-access/entities/user.entity';
import { Vehicle, VehicleDocument } from '@libs/data-access/entities/vehicle.entity';
import { RideStatus, RideTypes } from '@libs/data-access/enums/rides.enum';
import { VehicleType } from '@libs/data-access/enums/vehicle.enum';
import { roles } from '@libs/data-access/enums/user.enum';
import { AblyService } from '@libs/services/ably';
import {
  MATCHMAKING_CONFIG,
  MatchResult,
  MatchAttemptResult,
  DriverScore,
  FareBreakdown,
  WeatherCondition,
  TrafficCondition,
} from './config/matchmaking.config';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';

@Injectable()
export class MatchmakingService {
  private readonly logger = new Logger(MatchmakingService.name);

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Vehicle.name) private readonly vehicleModel: Model<VehicleDocument>,
    private readonly ablyService: AblyService,
    private readonly distanceCalculator: DistanceCalculatorService,
    private readonly pricingService: DynamicPricingService,
  ) {}

  /**
   * Main matchmaking entry point.
   * Implements the expanding-ring algorithm:
   *
   * Step 1: Start with 1 km radius around pickup
   * Step 2: Filter available drivers (online, matching ride_type, not on trip, rating >= 4.0)
   * Step 3: Score & sort candidates using: score = (dist*0.6) + (rating*-0.3) + (trips*0.1)
   * Step 4: Send ride request to best driver with 15-20s wait
   * Step 5: If rejected/timeout, expand ring and retry (1→2→4→7→10 km)
   * Step 6: After 10 km / 5 attempts, fail the ride
   */
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
      return {
        matched: false,
        rideId,
        rideUUId: '',
        passengerId: '',
        attempts: [],
        message: 'Ride not found',
      };
    }

    if (ride.rideStatus !== RideStatus.PENDING) {
      return {
        matched: false,
        rideId,
        rideUUId: ride.rideUUId,
        passengerId: ride.passengerId.toString(),
        attempts: [],
        message: `Ride is not in PENDING status. Current: ${ride.rideStatus}`,
      };
    }

    // Check if it's an INSTANT ride (scheduled rides follow a different path)
    if (ride.rideType !== RideTypes.INSTANT) {
      return {
        matched: false,
        rideId,
        rideUUId: ride.rideUUId,
        passengerId: ride.passengerId.toString(),
        attempts: [],
        message: 'Matchmaking is only available for INSTANT rides. Use scheduling for SCHEDULED rides.',
      };
    }

    const pickupCoords = ride.pickupLocation?.coordinates;
    if (!pickupCoords || pickupCoords.length < 2) {
      return {
        matched: false,
        rideId,
        rideUUId: ride.rideUUId,
        passengerId: ride.passengerId.toString(),
        attempts: [],
        message: 'Ride has no pickup coordinates',
      };
    }

    const pickupLat = pickupCoords[1];
    const pickupLng = pickupCoords[0];

    // Check if weather + vehicle type mismatch → suggest alternative
    const vehicle = ride.vehicle || (await this.vehicleModel.findById(ride.vehicleId).exec());
    const requestedType = (vehicle?.vehicleType as string) || 'CAR';
    const suggestedType = this.pricingService.getSuggestedVehicleType(requestedType, weather);
    if (suggestedType) {
      await this.ablyService.publish(
        `ride:${rideId}:passenger`,
        'vehicle-type-suggestion',
        {
          rideId,
          message: `Heavy weather detected. We recommend switching to ${suggestedType} for safety.`,
          suggestedVehicleType: suggestedType,
        },
      );
    }

    const dropoffCoords = ride.dropoffLocation?.coordinates;
    const dropoffLat = dropoffCoords?.[1];
    const dropoffLng = dropoffCoords?.[0];

    // Calculate the full route distance from pickup to dropoff using Batoo
    let routeDistanceKm = ride.distanceInKm || 0;
    let routeDurationMinutes = ride.estimatedTimeInMinutes || 0;

    if (dropoffLat && dropoffLng) {
      try {
        const route = await this.distanceCalculator.calculateDistance(
          pickupLat,
          pickupLng,
          dropoffLat,
          dropoffLng,
        );
        routeDistanceKm = route.distanceKm;
        routeDurationMinutes = route.durationMinutes;
      } catch (err) {
        this.logger.warn(`Failed to calculate route for fare: ${err}`);
      }
    }

    // Calculate estimated fare
    const estimatedFare = this.pricingService.calculateFare({
      distanceKm: routeDistanceKm,
      durationMinutes: routeDurationMinutes,
      vehicleType: requestedType,
      weather,
      traffic,
    });

    // ——— EXPANDING RING MATCHING ALGORITHM ———
    const attempts: MatchAttemptResult[] = [];
    const radii = MATCHMAKING_CONFIG.FALLBACK_RADII_KM;
    let matched = false;
    let acceptedDriverId: string | undefined;
    let acceptedDriverName: string | undefined;

    for (let attemptIdx = 0; attemptIdx < radii.length && !matched; attemptIdx++) {
      const radiusKm = radii[attemptIdx];
      const waitTimeSeconds =
        attemptIdx === 0
          ? MATCHMAKING_CONFIG.FIRST_ATTEMPT_WAIT_SECONDS
          : MATCHMAKING_CONFIG.SUBSEQUENT_ATTEMPT_WAIT_SECONDS;

      this.logger.log(
        `Attempt ${attemptIdx + 1}: Searching drivers within ${radiusKm} km radius`,
      );

      // Step 2: Find available drivers within this radius
      const drivers = await this.findAvailableDrivers(
        pickupLat,
        pickupLng,
        radiusKm,
        requestedType,
        attemptIdx,
      );

      if (drivers.length === 0) {
        this.logger.log(`No drivers found within ${radiusKm} km`);
        attempts.push({
          attemptNumber: attemptIdx + 1,
          radiusKm,
          waitTimeSeconds,
          driversFound: 0,
          driversRequested: 0,
          driverAccepted: false,
          timeoutExpired: false,
        });
        continue;
      }

      // Step 3: Score & sort candidates
      const scoredDrivers = this.scoreDrivers(drivers);

      // Step 4: Send ride request to the best drivers (top 5 or all if fewer)
      const batchSize = Math.min(
        MATCHMAKING_CONFIG.REQUEST_BATCH_SIZE,
        scoredDrivers.length,
      );
      const requestBatch = scoredDrivers.slice(0, batchSize);

      // Send ride requests via Ably
      for (const driver of requestBatch) {
        await this.ablyService.publish(
          `driver:${driver.driverId}:rides`,
          'ride-request',
          {
            rideId,
            rideUUId: ride.rideUUId,
            rideType: ride.rideType,
            pickupLocation: {
              address: ride.pickupLocation?.address,
              coordinates: ride.pickupLocation?.coordinates,
              city: ride.pickupLocation?.city,
            },
            dropoffLocation: ride.dropoffLocation
              ? {
                  address: ride.dropoffLocation.address,
                  coordinates: ride.dropoffLocation.coordinates,
                  city: ride.dropoffLocation.city,
                }
              : null,
            distanceInKm: routeDistanceKm,
            estimatedFare: estimatedFare.total,
            estimatedTimeInMinutes: routeDurationMinutes,
            passengerId: ride.passengerId.toString(),
            driverScore: driver.score,
            distanceToPickupKm: driver.distanceToPickupKm,
            expirySeconds: waitTimeSeconds,
            attemptNumber: attemptIdx + 1,
            weather,
            traffic,
          },
        );
        this.logger.log(
          `Ride request sent to driver ${driver.driverId} (score: ${driver.score.toFixed(2)}, dist: ${driver.distanceToPickupKm.toFixed(2)} km)`,
        );
      }

      // Step 4 cont: Wait for driver response (simulated via Ably subscription)
      // In production, this would use a proper timeout mechanism with Ably presence
      // or a dedicated response channel. Here we implement a promise-based wait.
      const driverResponse = await this.waitForDriverResponse(
        rideId,
        requestBatch.map((d) => d.driverId),
        waitTimeSeconds * 1000,
      );

      if (driverResponse.accepted) {
        // Driver accepted!
        matched = true;
        acceptedDriverId = driverResponse.driverId;
        acceptedDriverName =
          requestBatch.find((d) => d.driverId === driverResponse.driverId)?.fullName ||
          'Driver';

        // Update the ride in database
        await this.ridesModel.findByIdAndUpdate(ride._id, {
          driverId: new Types.ObjectId(acceptedDriverId),
          rideStatus: RideStatus.CONFIRMED,
          isFavourite: 0,
        });

        // Notify passenger
        await this.ablyService.publish(
          `ride:${rideId}:passenger`,
          'driver-accepted',
          {
            rideId,
            rideUUId: ride.rideUUId,
            driverId: acceptedDriverId,
            driverName: acceptedDriverName,
            estimatedFare,
            message: 'A driver has accepted your ride request',
          },
        );

        // Notify all other drivers that the ride is taken
        await this.ablyService.publish(
          `ride:${rideId}:drivers`,
          'ride-taken',
          { rideId, message: 'This ride has been accepted by another driver' },
        );

        this.logger.log(`Driver ${acceptedDriverId} accepted ride ${ride.rideUUId}`);
      }

      attempts.push({
        attemptNumber: attemptIdx + 1,
        radiusKm,
        waitTimeSeconds,
        driversFound: scoredDrivers.length,
        driversRequested: requestBatch.length,
        driverAccepted: driverResponse.accepted,
        acceptedDriverId: driverResponse.driverId,
        timeoutExpired: !driverResponse.accepted,
      });
    }

    // Step 6: After all attempts, check if matched
    if (!matched) {
      const failMessage =
        'No available drivers found within 10 km radius. Please try scheduling your ride.';
      await this.ablyService.publish(`ride:${rideId}:passenger`, 'match-failed', {
        rideId,
        rideUUId: ride.rideUUId,
        message: failMessage,
        suggestedAction: 'schedule',
      });

      return {
        matched: false,
        rideId,
        rideUUId: ride.rideUUId,
        passengerId: ride.passengerId.toString(),
        estimatedFare,
        attempts,
        message: failMessage,
      };
    }

    return {
      matched: true,
      rideId,
      rideUUId: ride.rideUUId,
      passengerId: ride.passengerId.toString(),
      driverId: acceptedDriverId,
      driverName: acceptedDriverName,
      estimatedFare,
      attempts,
      message: 'Driver matched successfully',
    };
  }

  /**
   * Find available drivers within a given radius.
   * Filters by:
   *  - Driver is online & available
   *  - Vehicle type matches requested ride type
   *  - Driver is not currently on a trip
   *  - Accept rating >= 4.0 (bypassed after 2 attempts)
   */
  private async findAvailableDrivers(
    pickupLat: number,
    pickupLng: number,
    radiusKm: number,
    vehicleType: string,
    attemptIndex: number,
  ): Promise<DriverScore[]> {
    // Find all vehicles matching the requested type
    const vehicles = await this.vehicleModel
      .find({ vehicleType: vehicleType as VehicleType, deleted: false })
      .populate('driverId')
      .limit(MATCHMAKING_CONFIG.MAX_DRIVERS_PER_RING)
      .exec();

    const drivers: DriverScore[] = [];

    for (const vehicle of vehicles) {
      const driver = vehicle.driverId as any as UserDocument;
      if (!driver) continue;

      // Filter: driver must be online (has role RIDER), verified, not suspended
      if (driver.suspended || !driver.verified) continue;
      if (driver.loginAs !== roles.RIDER) continue;

      // Filter: driver must not be on an active trip (check if has CONFIRMED/ONGOING ride)
      const activeRide = await this.ridesModel
        .findOne({
          driverId: driver._id,
          rideStatus: { $in: [RideStatus.CONFIRMED, RideStatus.ONGOING, RideStatus.PICKUP] },
          deleted: false,
        })
        .exec();

      if (activeRide) continue;

      // Filter: rating filter (bypassed after attempt 2)
      const minRating =
        attemptIndex < MATCHMAKING_CONFIG.BYPASS_RATING_AFTER_ATTEMPTS
          ? MATCHMAKING_CONFIG.MIN_ACCEPT_RATING
          : 0;

      // For now, use a default rating since the entity doesn't have a rating field yet.
      // In production, this would come from a driver_ratings collection.
      const driverRating = 4.5;
      if (driverRating < minRating) continue;

      // Calculate distance from driver to pickup
      // In production, drivers would have a currentLocation field updated via GPS
      // For now, simulate driver location near the pickup area for demo purposes
      const driverLat = pickupLat + (Math.random() - 0.5) * (radiusKm / 55.5);
      const driverLng = pickupLng + (Math.random() - 0.5) * (radiusKm / 55.5);

      const distResult = await this.distanceCalculator.calculateDriverDistance(
        pickupLat,
        pickupLng,
        driverLat,
        driverLng,
      );

      // Only include drivers within the specified radius
      if (distResult.distanceKm <= radiusKm) {
        // Count completed trips for this driver
        const completedTripsCount = await this.ridesModel
          .countDocuments({
            driverId: driver._id,
            rideStatus: RideStatus.COMPLETED,
            deleted: false,
          })
          .exec();

        drivers.push({
          driverId: driver._id.toString(),
          fullName: driver.fullName || 'Driver',
          phone: driver.phone || '',
          vehicleId: vehicle._id.toString(),
          vehicleModel: vehicle.vehicleModel,
          vehicleType: vehicle.vehicleType,
          color: vehicle.color,
          numberPlate: vehicle.numberPlate,
          distanceToPickupKm: distResult.distanceKm,
          rating: driverRating,
          completedTripsCount,
          score: 0, // calculated in next step
          estimatedTimeToReachMinutes: distResult.durationMinutes,
        });
      }
    }

    return drivers;
  }

  /**
   * Score candidates using the formula:
   * Score = (distance_to_pickup_km × 0.6) + (driver_rating × -0.3) + (completed_trips_count × 0.1)
   *
   * Lower score = better candidate.
   */
  private scoreDrivers(drivers: DriverScore[]): DriverScore[] {
    const { DISTANCE_WEIGHT, RATING_WEIGHT, COMPLETED_TRIPS_WEIGHT } =
      MATCHMAKING_CONFIG.SCORING;

    // Normalize values for fair scoring
    const maxDistance = Math.max(...drivers.map((d) => d.distanceToPickupKm), 1);
    const maxRating = 5.0;
    const maxTrips = Math.max(...drivers.map((d) => d.completedTripsCount), 1);

    for (const driver of drivers) {
      const normalizedDist = driver.distanceToPickupKm / maxDistance;
      const normalizedRating = driver.rating / maxRating;
      const normalizedTrips = driver.completedTripsCount / maxTrips;

      driver.score =
        normalizedDist * DISTANCE_WEIGHT +
        normalizedRating * RATING_WEIGHT +
        normalizedTrips * COMPLETED_TRIPS_WEIGHT;

      // Ensure score is not negative
      driver.score = Math.max(0, driver.score);
    }

    // Sort by score ascending (lower = better)
    return drivers.sort((a, b) => a.score - b.score);
  }

  /**
   * Wait for a driver to accept the ride request within the given timeout.
   * In production, this listens on Ably for the driver's response.
   */
  private async waitForDriverResponse(
    rideId: string,
    driverIds: string[],
    timeoutMs: number,
  ): Promise<{ accepted: boolean; driverId?: string }> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const timeout = setTimeout(() => {
        this.logger.log(`Driver response timeout for ride ${rideId} after ${timeoutMs}ms`);
        resolve({ accepted: false });
      }, timeoutMs);

      // Subscribe to driver response channel
      const unsubscribe = this.ablyService.subscribe(
        `ride:${rideId}:driver-response`,
        'driver-response',
        (message) => {
          const response = message.data as {
            driverId: string;
            action: 'accept' | 'reject';
          };

          if (
            response.action === 'accept' &&
            driverIds.includes(response.driverId)
          ) {
            clearTimeout(timeout);
            unsubscribe();
            resolve({ accepted: true, driverId: response.driverId });
          }
        },
      );

      // If scheduled ride, we can support pre-booking without real-time wait
      // For now, just wait for the timeout
    });
  }

  /**
   * Handle a driver's response to a ride request (accept/reject).
   * This is called by the controller via REST, or could be triggered
   * from an Ably subscription in a real production setup.
   */
  async handleDriverResponse(
    rideId: string,
    driverId: string,
    action: 'accept' | 'reject',
  ): Promise<{ success: boolean; message: string }> {
    // Publish the response to the matchmaking service's response channel
    await this.ablyService.publish(
      `ride:${rideId}:driver-response`,
      'driver-response',
      { driverId, action },
    );

    if (action === 'reject') {
      this.logger.log(`Driver ${driverId} rejected ride ${rideId}`);
      return { success: true, message: 'Ride rejected' };
    }

    this.logger.log(`Driver ${driverId} accepted ride ${rideId}`);
    return { success: true, message: 'Ride accepted' };
  }

  /**
   * Get the current estimated fare for a ride (for recalculation during matching)
   */
  async getEstimatedFare(
    rideId: string,
    weather?: WeatherCondition,
    traffic?: TrafficCondition,
  ): Promise<FareBreakdown | null> {
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
        const route = await this.distanceCalculator.calculateDistance(
          pickupCoords[1],
          pickupCoords[0],
          dropoffCoords[1],
          dropoffCoords[0],
        );
        distanceKm = route.distanceKm;
        durationMinutes = route.durationMinutes;
      } catch {
        // Use defaults
      }
    }

    return this.pricingService.calculateFare({
      distanceKm,
      durationMinutes,
      vehicleType,
      weather,
      traffic,
    });
  }
}