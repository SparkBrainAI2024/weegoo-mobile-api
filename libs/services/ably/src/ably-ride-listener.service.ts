import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { AblyService } from './ably.service';

export interface RideRequestEvent {
  rideId: string;
  rideUUId: string;
  rideType?: string;
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
  bookingTime?: string;
  driverImage?: string | null;
  rating?: number;
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
   * Subscribe to the unified ride channel for a specific ride.
   * All events come through the `ride-detail` event on the ride's ablyChannelId.
   * Uses the `eventType` field in the payload to differentiate.
   * Returns an unsubscribe function.
   */
  subscribeToRideChannel(
    rideUUId: string,
    rideId: string,
    callback: (eventType: string, data: any) => void,
  ): () => void {
    const channel = `WG-RIDE-${rideUUId}-ride-details`;
    const key = `ride-channel-${rideUUId}`;

    const unsubscribe = this.ablyService.subscribe(channel, 'ride-detail', (message) => {
      const data = message.data;
      this.logger.log(`Received ride-detail event (${data.eventType}) for ride ${rideId}`);
      callback(data.eventType, data);
    });

    this.subscriptions.set(key, unsubscribe);
    return () => {
      const unsub = this.subscriptions.get(key);
      if (unsub) {
        unsub();
        this.subscriptions.delete(key);
      }
    };
  }

  /**
   * Acknowledge the ride request as read (for metrics).
   */
  async acknowledgeRideRequest(driverId: string, rideId: string): Promise<void> {
    // No-op: acknowledgments are no longer published separately
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