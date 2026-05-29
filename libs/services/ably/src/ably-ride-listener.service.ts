import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AblyService } from './ably.service';

export interface RideRequestEvent {
  rideId: string;
  rideUUId: string;
  pickupLocation: any;
  dropoffLocation: any;
  distanceInKm: number;
  estimatedFare: number;
  estimatedTimeInMinutes: number;
  passengerId: string;
  driverScore: number;
  distanceToPickupKm: number;
  expirySeconds: number;
  attemptNumber: number;
  isScheduled?: boolean;
  weather?: string;
  traffic?: string;
}

export interface DriverResponseEvent {
  driverId: string;
  action: 'accept' | 'reject';
}

@Injectable()
export class AblyRideListenerService implements OnModuleDestroy {
  private readonly logger = new Logger(AblyRideListenerService.name);
  private subscriptions: Map<string, () => void> = new Map();
  private driverResponseSubscriptions: Map<string, () => void> = new Map();

  constructor(private readonly ablyService: AblyService) {}

  /**
   * Subscribe to ride requests directed to a specific driver.
   * Returns an unsubscribe function.
   */
  subscribeToDriverRideRequests(
    driverId: string,
    onRideRequest: (event: RideRequestEvent) => void,
    onRideTaken: (data: any) => void,
  ): () => void {
    const channel = `driver:${driverId}:rides`;
    const key = `ride-request-${driverId}`;

    const unsubscribe = this.ablyService.subscribe(channel, 'ride-request', (message) => {
      this.logger.log(`Ride request received for driver ${driverId}`);
      onRideRequest(message.data as RideRequestEvent);
    });

    const unsubscribeTaken = this.ablyService.subscribe(channel, 'ride-taken', (message) => {
      this.logger.log(`Ride taken notification for driver ${driverId}`);
      onRideTaken(message.data);
    });

    this.subscriptions.set(key, () => {
      unsubscribe();
      unsubscribeTaken();
    });

    return () => {
      const unsub = this.subscriptions.get(key);
      if (unsub) {
        unsub();
        this.subscriptions.delete(key);
      }
    };
  }

  /**
   * Subscribe to scheduled ride requests directed to a specific driver.
   */
  subscribeToDriverScheduledRequests(
    driverId: string,
    onRideRequest: (event: RideRequestEvent) => void,
  ): () => void {
    const channel = `driver:${driverId}:rides`;
    const key = `scheduled-ride-request-${driverId}`;

    const unsubscribe = this.ablyService.subscribe(channel, 'scheduled-ride-request', (message) => {
      this.logger.log(`Scheduled ride request received for driver ${driverId}`);
      onRideRequest(message.data as RideRequestEvent);
    });

    this.subscriptions.set(key, unsubscribe);
    return unsubscribe;
  }

  /**
   * Subscribe to passenger channel for match updates.
   */
  subscribeToPassengerUpdates(
    rideId: string,
    onMatchResult: (data: any) => void,
    onDriverAccepted: (data: any) => void,
    onMatchFailed: (data: any) => void,
  ): () => void {
    const channel = `ride:${rideId}:passenger`;
    const key = `passenger-${rideId}`;

    const unsub1 = this.ablyService.subscribe(channel, 'driver-match', onMatchResult);
    const unsub2 = this.ablyService.subscribe(channel, 'driver-accepted', onDriverAccepted);
    const unsub3 = this.ablyService.subscribe(channel, 'match-failed', onMatchFailed);

    const unsubAll = () => { unsub1(); unsub2(); unsub3(); };
    this.subscriptions.set(key, unsubAll);
    return unsubAll;
  }

  /**
   * Acknowledge the ride request as read (for metrics).
   */
  async acknowledgeRideRequest(driverId: string, rideId: string): Promise<void> {
    await this.ablyService.publish(
      `driver:${driverId}:ack`,
      'ride-request-ack',
      { driverId, rideId, acknowledgedAt: new Date().toISOString() },
    );
  }

  onModuleDestroy() {
    for (const [, unsubscribe] of this.subscriptions) {
      unsubscribe();
    }
    for (const [, unsubscribe] of this.driverResponseSubscriptions) {
      unsubscribe();
    }
    this.subscriptions.clear();
    this.driverResponseSubscriptions.clear();
  }
}