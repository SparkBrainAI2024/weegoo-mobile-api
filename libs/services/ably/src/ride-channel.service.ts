import { Injectable, Logger } from '@nestjs/common';
import { AblyService } from './ably.service';

/**
 * Service for managing the unified ride channel.
 * 
 * Each ride has ONE Ably channel: `WG-RIDE-${rideUUId}-ride-details` (the ablyChannelId).
 * 
 * ALL ride-related information is published to this single channel
 * with the same event name: `ride-detail`.
 * 
 * Clients subscribe to `ride-detail` and use the `eventType` field
 * in the payload to differentiate message types:
 * 
 * - `driver-ride-request`       → Matchmaking: ride request sent to a driver
 * - `driver-accepted`           → Driver accepted the ride
 * - `driver-rejected`           → Driver rejected the ride
 * - `ride-taken`                → Ride taken by another driver
 * - `match-failed`              → No driver found
 * - `driver-location-update`    → Driver's current location
 * - `passenger-location-update` → Passenger's current location
 * - `ride-status-update`        → Ride status changed
 * - `ride-details`              → Full ride information update
 * - `driver-response`           → Driver accept/reject (for internal flow)
 */
@Injectable()
export class RideChannelService {
  private readonly logger = new Logger(RideChannelService.name);

  /** The single event name used for ALL ride channel publications */
  static readonly RIDE_EVENT = 'ride-detail';

  constructor(private readonly ablyService: AblyService) {}

  /**
   * Generate the unified channel name for a ride.
   */
  static getChannelName(rideUUId: string): string {
    return `WG-RIDE-${rideUUId}-ride-details`;
  }

  static getDriverLocationChannelName(driverId: string): string {
    return `WG-DRIVER-${driverId}-driver-location`;
  }

  static getPassengerLocationChannelName(passengerId: string): string {
    return `WG-PASSENGER-${passengerId}-passenger-location`;
  }

  // ════════════════════════════════════════════════════════════════
  //  Publishing Methods
  // ══════════════════════════════════════════
  //  Core Publish (single channel + single event)
  // ════════════════════════════════════════════════════════════════

  /**
   * Publish to the ride channel with the unified `ride-detail` event.
   * @param rideUUId - The ride UUID
   * @param eventType - The type of event (e.g. 'driver-accepted', 'ride-taken')
   * @param data - The data payload (will be merged with rideUUId, eventType, timestamp)
   */
  async publishRideEvent(
    rideUUId: string,
    eventType: string,
    data: Record<string, any>,
  ): Promise<void> {
    const channel = RideChannelService.getChannelName(rideUUId);
    await this.ablyService.publish(channel, RideChannelService.RIDE_EVENT, {
      ...data,
      rideUUId,
      eventType,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`Published ${eventType} to channel ${channel}`);
  }

  // ════════════════════════════════════════════════════════════════
  //  Publishing Methods (all use ride-detail event)
  // ════════════════════════════════════════════════════════════════

  /**
   * Publish driver response (accept/reject) to the unified ride channel.
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
    await this.publishRideEvent(rideUUId, `driver-${data.action}`, {
      rideId: data.rideId ?? null,
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
  }

  /**
   * Publish driver location update to the ride channel.
   */
  async publishDriverLocationUpdate(rideUUId: string, data: DriverLocationPayload): Promise<void> {
    await this.publishRideEvent(rideUUId, 'driver-location-update', data as any);
  }

  /**
   * Publish passenger location update to the ride channel.
   */
  async publishPassengerLocationUpdate(rideUUId: string, data: PassengerLocationPayload): Promise<void> {
    await this.publishRideEvent(rideUUId, 'passenger-location-update', data as any);
  }

  /**
   * Publish full ride details update to the unified ride channel.
   */
  async publishRideDetails(rideUUId: string, data: RideDetailsPayload): Promise<void> {
    await this.publishRideEvent(rideUUId, 'ride-details', data as any);
  }

  /**
   * Publish ride status change.
   */
  async publishRideStatusUpdate(rideUUId: string, data: RideStatusPayload): Promise<void> {
    await this.publishRideEvent(rideUUId, 'ride-status-update', data as any);
  }

  /**
   * Publish driver accepted event with full driver/vehicle/passenger details.
   */
  async publishDriverAccepted(rideUUId: string, data: DriverAcceptedPayload): Promise<void> {
    await this.publishRideEvent(rideUUId, 'driver-accepted', data as any);
  }

  /**
   * Publish ride-taken event (ride accepted by another driver).
   */
  async publishRideTaken(rideUUId: string, rideId: string): Promise<void> {
    await this.publishRideEvent(rideUUId, 'ride-taken', {
      rideId,
      message: 'This ride has been accepted by another driver',
    });
  }

  /**
   * Publish match-failed event (no driver found).
   */
  async publishMatchFailed(rideUUId: string, rideId: string, message: string, suggestedAction?: string): Promise<void> {
    await this.publishRideEvent(rideUUId, 'match-failed', {
      rideId,
      message,
      suggestedAction,
    });
  }

  /**
   * Publish a matchmaking ride request event to the ride channel.
   * Used during instant/scheduled matchmaking to notify about driver requests.
   */
  async publishMatchmakingRideRequest(rideUUId: string, data: {
    rideId: string;
    rideType?: string;
    pickupLocation?: any;
    dropoffLocation?: any;
    distanceInKm?: number;
    estimatedFare?: number;
    estimatedTimeInMinutes?: number;
    passengerId?: string;
    driverScore?: number;
    distanceToPickupKm?: number;
    expirySeconds?: number;
    attemptNumber?: number;
    isScheduled?: boolean;
    bookingTime?: string;
    driverImage?: string | null;
    rating?: number | null;
    driverId?: string;
    driverName?: string;
  }): Promise<void> {
    await this.publishRideEvent(rideUUId, 'driver-ride-request', data);
  }

  // ════════════════════════════════════════════════════════════════
  //  Channel Release
  // ════════════════════════════════════════════════════════════════

  /**
   * Publish driver location to the driver's personal location channel.
   * Other services (matchmaking, passenger app) can subscribe to this channel
   * to receive real-time driver location updates.
   */
  async publishDriverLocationToChannel(driverId: string, data: {
    driverId: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  }): Promise<void> {
    const channel = RideChannelService.getDriverLocationChannelName(driverId);
    await this.ablyService.publish(channel, 'driver-location-update', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`Published driver-location-update to channel ${channel}`);
  }

  /**
   * Publish passenger location to the passenger's personal location channel.
   */
  async publishPassengerLocationToChannel(passengerId: string, data: {
    passengerId: string;
    latitude: number;
    longitude: number;
    updatedAt: string;
  }): Promise<void> {
    const channel = RideChannelService.getPassengerLocationChannelName(passengerId);
    await this.ablyService.publish(channel, 'passenger-location-update', {
      ...data,
      timestamp: new Date().toISOString(),
    });
    this.logger.debug(`Published passenger-location-update to channel ${channel}`);
  }

  /**
   * Subscribe to a driver's personal location channel.
   * Returns an unsubscribe function.
   */
  subscribeToDriverLocationChannel(
    driverId: string,
    callback: (data: any) => void,
  ): () => void {
    const channel = RideChannelService.getDriverLocationChannelName(driverId);
    return this.ablyService.subscribe(channel, 'driver-location-update', (message) => {
      callback(message.data);
    });
  }

  /**
   * Subscribe to a passenger's personal location channel.
   * Returns an unsubscribe function.
   */
  subscribeToPassengerLocationChannel(
    passengerId: string,
    callback: (data: any) => void,
  ): () => void {
    const channel = RideChannelService.getPassengerLocationChannelName(passengerId);
    return this.ablyService.subscribe(channel, 'passenger-location-update', (message) => {
      callback(message.data);
    });
  }

  /**
   * Subscribe to the unified ride channel for a specific event.
   * Release the ride channel after ride completion or cancellation.
   * Cleans up the Ably channel from the client.
   */
  releaseRideChannel(rideUUId: string): void {
    const channel = RideChannelService.getChannelName(rideUUId);
    this.ablyService.releaseChannel(channel);
  }

  // ════════════════════════════════════════════════════════════════
  //  Subscriptions
  // ════════════════════════════════════════════════════════════════

  /**
   * Subscribe to the unified ride channel for the ride-detail event.
   * Returns an unsubscribe function.
   */
  subscribeToRideEvent(
    rideUUId: string,
    callback: (eventType: string, data: any) => void,
  ): () => void {
    const channel = RideChannelService.getChannelName(rideUUId);
    return this.ablyService.subscribe(channel, RideChannelService.RIDE_EVENT, (message) => {
      callback(message.data.eventType, message.data);
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