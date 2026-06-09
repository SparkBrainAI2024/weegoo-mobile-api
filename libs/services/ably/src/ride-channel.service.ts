import { Injectable, Logger } from '@nestjs/common';
import { AblyService } from './ably.service';

/**
 * Service for managing the unified ride channel.
 * 
 * Each ride has ONE Ably channel: `WG-RIDE-${rideUUId}-ride-details`
 * 
 * All ride-related information is published to this single channel
 * with different event names to differentiate message types:
 * 
 * - `ride-details`              → Full ride information update (fare, distance, ETA, locations, driver, passenger, vehicle, status)
 * - `driver-location-update`    → Driver's current location (lat/lng, distance to passenger, ETA)
 * - `passenger-location-update` → Passenger's current location (lat/lng)
 * - `ride-status-update`        → Ride status changed (CONFIRMED, ONGOING, PICKUP, COMPLETED)
 * - `driver-accepted`           → Driver accepted the ride (full details)
 * - `ride-taken`                → Ride taken by another driver
 * - `match-failed`              → No driver found
 */
@Injectable()
export class RideChannelService {
  private readonly logger = new Logger(RideChannelService.name);

  constructor(private readonly ablyService: AblyService) {}

  /**
   * Generate the unified channel name for a ride.
   */
  static getChannelName(rideUUId: string): string {
    return `WG-RIDE-${rideUUId}-ride-details`;
  }

  // ════════════════════════════════════════════════════════════════
  //  Publishing Methods
  // ════════════════════════════════════════════════════════════════

  /**
   * Publish to the matchmaking driver-response channel (internal matchmaking use).
   */
  async publishDriverResponse(rideUUId: string, driverId: string, action: 'accept' | 'reject'): Promise<void> {
    const channel = `WG-RIDE-${rideUUId}:driver-response`;
    await this.ablyService.publish(channel, 'driver-response', { driverId, action });
    this.logger.debug(`Published driver-response for ride ${rideUUId}: ${action}`);
  }

  /**
   * Publish driver response (accept/reject) to the unified ride channel.
   * All fields are nullable if they don't exist, but eventName and timestamp are always present.
   */
  async publishDriverResponseToRideChannel(
    rideUUId: string,
    data: {
      rideId: string;
      driverId: string;
      action: 'accept' | 'reject';
      driverName?: string | null;
      driverImage?: string | null;
      rating?: number | null;
      vehicleType?: string | null;
      vehicleModel?: string | null;
      color?: string | null;
      numberPlate?: string | null;
      estimatedFare?: number | null;
      estimatedTimeInMinutes?: number | null;
      distanceInKm?: number | null;
    },
  ): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'driver-response', {
      eventName: `driver-${data.action}`,
      timestamp: new Date().toISOString(),
      rideId: data.rideId ?? null,
      rideUUId,
      driverId: data.driverId ?? null,
      action: data.action,
      driverName: data.driverName ?? null,
      driverImage: data.driverImage ?? null,
      rating: data.rating ?? null,
      vehicleType: data.vehicleType ?? null,
      vehicleModel: data.vehicleModel ?? null,
      color: data.color ?? null,
      numberPlate: data.numberPlate ?? null,
      estimatedFare: data.estimatedFare ?? null,
      estimatedTimeInMinutes: data.estimatedTimeInMinutes ?? null,
      distanceInKm: data.distanceInKm ?? null,
    });
    this.logger.debug(`Published driver-response to unified ride channel for ${rideUUId}: ${data.action}`);
  }

  /**
   * Publish driver location update to the ride channel.
   */
  async publishDriverLocationUpdate(rideUUId: string, data: DriverLocationPayload): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'driver-location-update', data);
    this.logger.debug(`Published driver-location-update for ride ${rideUUId}`);
  }

  /**
   * Publish passenger location update to the ride channel.
   */
  async publishPassengerLocationUpdate(rideUUId: string, data: PassengerLocationPayload): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'passenger-location-update', data);
    this.logger.debug(`Published passenger-location-update for ride ${rideUUId}`);
  }

  /**
   * Publish full ride details update to the unified ride channel.
   */
  async publishRideDetails(rideUUId: string, data: RideDetailsPayload): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'ride-details', data);
    this.logger.debug(`Published ride-details for ride ${rideUUId}`);
  }

  /**
   * Publish ride status change.
   */
  async publishRideStatusUpdate(rideUUId: string, data: RideStatusPayload): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'ride-status-update', data);
    this.logger.debug(`Published ride-status-update for ride ${rideUUId}: ${data.status}`);
  }

  /**
   * Publish driver accepted event with full driver/vehicle/passenger details.
   */
  async publishDriverAccepted(rideUUId: string, data: DriverAcceptedPayload): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'driver-accepted', data);
    this.logger.debug(`Published driver-accepted for ride ${rideUUId}`);
  }

  /**
   * Publish ride-taken event (ride accepted by another driver).
   */
  async publishRideTaken(rideUUId: string, rideId: string): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'ride-taken', {
      rideId,
      rideUUId,
      message: 'This ride has been accepted by another driver',
    });
    this.logger.debug(`Published ride-taken for ride ${rideUUId}`);
  }

  /**
   * Publish match-failed event (no driver found).
   */
  async publishMatchFailed(rideUUId: string, rideId: string, message: string, suggestedAction?: string): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, 'match-failed', {
      rideId,
      rideUUId,
      message,
      suggestedAction,
    });
    this.logger.debug(`Published match-failed for ride ${rideUUId}`);
  }

  /**
   * Subscribe to driver response for matchmaking (internal use).
   */
  subscribeToDriverResponse(
    rideUUId: string,
    callback: (data: { driverId: string; action: 'accept' | 'reject' }) => void,
  ): () => void {
    const channel = `WG-RIDE-${rideUUId}:driver-response`;
    return this.ablyService.subscribe(channel, 'driver-response', (message) => {
      callback(message.data);
    });
  }

  /**
   * Subscribe to the unified ride channel for a specific event.
   * Returns an unsubscribe function.
   */
  subscribeToRideChannel(
    rideUUId: string,
    eventName: string,
    callback: (data: any) => void,
  ): () => void {
    const channel = RideChannelService.getChannelName(rideUUId);
    return this.ablyService.subscribe(channel, eventName, (message) => {
      callback(message.data);
    });
  }

  /**
   * Subscribe to ALL events on the unified ride channel.
   * Returns an unsubscribe function.
   */
  subscribeToAllRideEvents(
    rideUUId: string,
    callback: (eventName: string, data: any) => void,
  ): () => void {
    const channel = RideChannelService.getChannelName(rideUUId);
    return this.ablyService.subscribe(channel, (message) => {
      callback(message.name, message.data);
    });
  }
}

// ════════════════════════════════════════════════════════════════
//  Payload Type Definitions
// ════════════════════════════════════════════════════════════════

export interface RideDetailsPayload {
  rideId: string;
  rideUUId: string;
  rideType: string;
  rideStatus: string;
  bookingTime?: string;

  // Locations
  pickupLocation?: {
    address: string;
    coordinates: number[];
    city?: string;
  };
  dropoffLocation?: {
    address: string;
    coordinates: number[];
    city?: string;
  };

  // Distance & Fare
  distanceInKm: number;
  estimatedFare: number;
  estimatedTimeInMinutes: number;

  // Driver details
  driver?: {
    driverId: string;
    fullName: string;
    phone?: string;
    profileImage?: string;
    rating?: number;
  };

  // Vehicle details
  vehicle?: {
    vehicleId: string;
    vehicleModel: string;
    vehicleType: string;
    color: string;
    numberPlate: string;
    year: number;
  };

  // Passenger details
  passenger?: {
    passengerId: string;
    fullName: string;
    phone?: string;
    profileImage?: string;
  };

  // Match info
  matchedAttempts?: number;

  // Location tracking
  driverLocation?: {
    latitude: number;
    longitude: number;
  };
  passengerLocation?: {
    latitude: number;
    longitude: number;
  };
  distanceToReachPassenger?: number;
  estimatedTimeToReachPassenger?: number;

  // Timestamps
  rideStartedAt?: string;
  rideCompletedAt?: string;
  updatedAt?: string;
}

export interface DriverLocationPayload {
  driverId: string;
  latitude: number;
  longitude: number;
  distanceToReachPassenger: number;
  estimatedTimeToReachPassenger: number;
  updatedAt: string;
}

export interface PassengerLocationPayload {
  passengerId: string;
  latitude: number;
  longitude: number;
  distanceToReachPassenger: number;
  estimatedTimeToReachPassenger: number;
  updatedAt: string;
}

export interface RideStatusPayload {
  rideId: string;
  rideUUId: string;
  status: string;
  updatedAt: string;
}

export interface DriverAcceptedPayload {
  rideId: string;
  rideUUId: string;
  driver: {
    driverId: string;
    fullName: string;
    phone?: string;
    profileImage?: string;
    rating?: number;
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
    phone?: string;
  };
  pickupLocation?: {
    address: string;
    coordinates: number[];
    city?: string;
  };
  dropoffLocation?: {
    address: string;
    coordinates: number[];
    city?: string;
  };
  estimatedFare: number;
  estimatedTimeInMinutes: number;
  distanceInKm: number;
  bookingTime?: string;
  acceptedAt: string;
}