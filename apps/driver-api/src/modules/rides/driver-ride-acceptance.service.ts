import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rides, RidesDocument } from '@libs/data-access/entities/rides.entity';
import { RideStatus } from '@libs/data-access/enums/rides.enum';
import { AblyRideListenerService, AblyService } from '@libs/services/ably';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';

/**
 * Driver-side ride acceptance service.
 * Listens for ride requests via Ably and allows drivers to accept/reject.
 * Implements ride locking: once a driver accepts, the ride is locked (CONFIRMED)
 * and no other driver can accept.
 */
@Injectable()
export class DriverRideAcceptanceService implements OnModuleInit {
  private readonly logger = new Logger(DriverRideAcceptanceService.name);
  private driverId: string; // In production, this comes from the authenticated driver's session

  constructor(
    @InjectModel(Rides.name) private readonly ridesModel: Model<RidesDocument>,
    private readonly ablyListenerService: AblyRideListenerService,
    private readonly ablyService: AblyService,
    private readonly envService: EnvService,
  ) {}

  onModuleInit() {
    // In production, the driver would authenticate first, then call subscribeForDriver
    // The subscription is shown here for the architectural pattern.
    this.logger.log('Driver ride acceptance service initialized. Awaiting driver authentication.');
  }

  /**
   * Subscribe a specific driver to ride requests.
   * Called when a driver comes online.
   */
  async subscribeForDriver(driverId: string): Promise<void> {
    this.driverId = driverId;

    this.ablyListenerService.subscribeToDriverRideRequests(
      driverId,
      (rideRequest) => {
        this.logger.log(
          `Driver ${driverId}: Received ride request for ride ${rideRequest.rideUUId} (${rideRequest.distanceInKm}km, $${rideRequest.estimatedFare})`,
        );
        // In a real app, this would push to the driver's mobile app via WebSocket or push notification
        // The driver then calls acceptRide() or rejectRide()
      },
      (rideTaken) => {
        this.logger.log(`Driver ${driverId}: Ride ${rideTaken.rideId} was taken by another driver`);
      },
    );

    this.ablyListenerService.subscribeToDriverScheduledRequests(driverId, (rideRequest) => {
      this.logger.log(`Driver ${driverId}: Received scheduled ride request for ride ${rideRequest.rideUUId}`);
    });

    this.logger.log(`Driver ${driverId} subscribed to ride requests`);
  }

  /**
   * Driver accepts a ride.
   * Locks the ride by setting status to CONFIRMED and assigning the driver.
   * Uses atomic findOneAndUpdate with status check to prevent race conditions.
   */
  async acceptRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} attempting to accept ride ${rideId}`);

    // Atomic lock: only update if still PENDING
    const updatedRide = await this.ridesModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(rideId),
        rideStatus: RideStatus.PENDING, // Only lock if still pending
      },
      {
        $set: {
          driverId: new Types.ObjectId(driverId),
          rideStatus: RideStatus.CONFIRMED,
        },
      },
      { new: true },
    ).exec();

    if (!updatedRide) {
      // Ride was already taken by another driver or is not in PENDING status
      this.logger.warn(`Driver ${driverId}: Ride ${rideId} was already locked by another driver`);
      return { success: false, message: 'Ride was already accepted by another driver' };
    }

    this.logger.log(`Driver ${driverId} successfully locked ride ${rideId}`);

    // Publish acceptance via Ably to both passenger and matchmaking service
    await this.ablyService.publish(`ride:${rideId}:passenger`, 'driver-accepted', {
      rideId,
      driverId,
      message: 'A driver has accepted your ride request',
    });

    // Notify matchmaking service that this driver accepted
    await this.ablyService.publish(`ride:${rideId}:driver-response`, 'driver-response', {
      driverId,
      action: 'accept',
    });

    // Notify all other drivers that the ride is taken
    await this.ablyService.publish(`ride:${rideId}:drivers`, 'ride-taken', {
      rideId,
      message: 'This ride has been accepted by another driver',
    });

    return { success: true, message: 'Ride accepted successfully' };
  }

  /**
   * Driver rejects a ride.
   */
  async rejectRide(rideId: string, driverId: string): Promise<{ success: boolean; message: string }> {
    this.logger.log(`Driver ${driverId} rejected ride ${rideId}`);

    // Notify matchmaking service that this driver rejected
    await this.ablyService.publish(`ride:${rideId}:driver-response`, 'driver-response', {
      driverId,
      action: 'reject',
    });

    return { success: true, message: 'Ride rejected' };
  }

  /**
   * Get the matchmaking result for a ride (to check if matched).
   */
  async getMatchmakingResult(rideId: string): Promise<any> {
    const matchmakingUrl = this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:4000');
    try {
      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            query GetMatchStatus($input: EstimatedFareInput!) {
              estimatedFare(input: $input) { total }
            }
          `,
          variables: { input: { rideId } },
        },
        { timeout: 5000 },
      );
      return response.data?.data;
    } catch (error: any) {
      this.logger.warn(`Failed to get matchmaking result: ${error?.message || error}`);
      return null;
    }
  }
}