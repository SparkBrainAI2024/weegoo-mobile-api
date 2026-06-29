import { Resolver, Mutation, Query, Args, Int } from '@nestjs/graphql';
import { Logger, BadRequestException } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import {
  VehicleEstimateGraphQL,
  MatchResultGraphQL,
  DriverResponseResultGraphQL,
  FareBreakdownGraphQL,
  ScheduledMatchResultGraphQL,
  ScheduledFareBreakdownGraphQL,
  CompleteRideResult,
  MatchDriversInput,
  MatchScheduledDriversInput,
  DriverResponseInput,
  EstimatedFareInput,
  ScheduledFareInput,
  RideLocationInput,
  RainCondition, 
  HistoricalTraffic,
} from '@libs/data-access';
import { PaymentMethodEnum } from '@libs/data-access/enums/payment.enum';
import { BasicResult } from './basic-result.dto';



@Resolver()
export class MatchmakingResolver {
  private readonly logger = new Logger(MatchmakingResolver.name);

  constructor(private readonly matchmakingService: MatchmakingService) {}

  @Mutation(() => MatchResultGraphQL, {
    name: 'matchDrivers',
    description: 'Find and notify nearby drivers for an INSTANT ride using expanding-ring algorithm',
  })
  async matchDrivers(@Args('input') input: MatchDriversInput): Promise<MatchResultGraphQL> {
    this.logger.log(`GraphQL: INSTANT matchmaking triggered for ride: ${input.rideId}`);
    const result = await this.matchmakingService.matchDrivers({ rideId: input.rideId });
    this.logger.log(`result new ${JSON.stringify(result)}`)
    return {
      matched: result.matched, rideId: result.rideId, rideUUId: result.rideUUId, passengerId: result.passengerId,
      driverId: result.driverId, driverName: result.driverName,
      driverImage: result.driverImage || null, rating: result.rating || null,
      estimatedFare: result.estimatedFare ? {
        pickupCost: result.estimatedFare.pickupCost, distanceCost: result.estimatedFare.distanceCost,
        durationCost: result.estimatedFare.durationCost, total: result.estimatedFare.total,
      } : undefined,
      attempts: result.attempts.map((a) => ({
        attemptNumber: a.attemptNumber, radiusKm: a.radiusKm, waitTimeSeconds: a.waitTimeSeconds,
        driversFound: a.driversFound, driversRequested: a.driversRequested, driverAccepted: a.driverAccepted,
        acceptedDriverId: a.acceptedDriverId, timeoutExpired: a.timeoutExpired, status: a.status,
      })),
      message: result.message,
      ablyChannelId: result.ablyChannelId || `WG-RIDE-${result.rideUUId}-ride-details`,
      acceptedDetails: result.acceptedDetails ? {
        rideId: result.acceptedDetails.rideId,
        rideUUId: result.acceptedDetails.rideUUId,
        driverId: result.acceptedDetails.driver.driverId,
        driverName: result.acceptedDetails.driver.fullName,
        driverImage: result.acceptedDetails.driver.profileImage || null,
        phone: result.acceptedDetails.driver.phone,
        rating: result.acceptedDetails.driver.rating,
        vehicleModel: result.acceptedDetails.vehicle.vehicleModel,
        vehicleType: result.acceptedDetails.vehicle.vehicleType,
        color: result.acceptedDetails.vehicle.color,
        numberPlate: result.acceptedDetails.vehicle.numberPlate,
        pickupLocation: { address: result.acceptedDetails.pickupLocation.address, coordinates: result.acceptedDetails.pickupLocation.coordinates, city: result.acceptedDetails.pickupLocation.city },
        dropoffLocation: result.acceptedDetails.dropoffLocation ? { address: result.acceptedDetails.dropoffLocation.address, coordinates: result.acceptedDetails.dropoffLocation.coordinates, city: result.acceptedDetails.dropoffLocation.city } : undefined,
        estimatedFare: result.acceptedDetails.estimatedFare,
        estimatedTimeInMinutes: result.acceptedDetails.estimatedTimeInMinutes,
        distanceInKm: result.acceptedDetails.distanceInKm,
        acceptedAt: result.acceptedDetails.acceptedAt,
      } : undefined,
    };
  }

  @Mutation(() => ScheduledMatchResultGraphQL, {
    name: 'matchScheduledDrivers',
    description: 'Find and notify drivers for a SCHEDULED ride using expanding-ring algorithm (1→3→5→10→15 km)',
  })
  async matchScheduledDrivers(@Args('input') input: MatchScheduledDriversInput): Promise<ScheduledMatchResultGraphQL> {
    this.logger.log(`GraphQL: SCHEDULED matchmaking triggered for ride: ${input.rideId}`);
    const result = await this.matchmakingService.matchScheduledDrivers({
      rideId: input.rideId,
    });

    return {
      matched: result.matched, rideId: result.rideId, rideUUId: result.rideUUId, passengerId: result.passengerId,
      driverId: result.driverId, driverName: result.driverName,
      estimatedFare: result.estimatedFare ? {
        baseFare: result.estimatedFare.baseFare, 
        total: result.estimatedFare.total,
      } : undefined,
      attempts: result.attempts.map((a) => ({
        attemptNumber: a.attemptNumber, radiusKm: a.radiusKm, waitTimeSeconds: a.waitTimeSeconds,
        driversFound: a.driversFound, driversRequested: a.driversRequested, driverAccepted: a.driverAccepted,
        acceptedDriverId: a.acceptedDriverId, timeoutExpired: a.timeoutExpired, status: a.status,
      })),
      message: result.message,
      ablyChannelId: result.ablyChannelId || `WG-RIDE-${result.rideUUId}-ride-details`,
      acceptedDetails: result.acceptedDetails ? {
        rideId: result.acceptedDetails.rideId,
        rideUUId: result.acceptedDetails.rideUUId,
        driverId: result.acceptedDetails.driver.driverId,
        driverName: result.acceptedDetails.driver.fullName,
        driverImage: result.acceptedDetails.driver.profileImage || null,
        phone: result.acceptedDetails.driver.phone,
        rating: result.acceptedDetails.driver.rating,
        vehicleModel: result.acceptedDetails.vehicle.vehicleModel,
        vehicleType: result.acceptedDetails.vehicle.vehicleType,
        color: result.acceptedDetails.vehicle.color,
        numberPlate: result.acceptedDetails.vehicle.numberPlate,
        pickupLocation: { address: result.acceptedDetails.pickupLocation.address, coordinates: result.acceptedDetails.pickupLocation.coordinates, city: result.acceptedDetails.pickupLocation.city },
        dropoffLocation: result.acceptedDetails.dropoffLocation ? { address: result.acceptedDetails.dropoffLocation.address, coordinates: result.acceptedDetails.dropoffLocation.coordinates, city: result.acceptedDetails.dropoffLocation.city } : undefined,
        estimatedFare: result.acceptedDetails.estimatedFare,
        estimatedTimeInMinutes: result.acceptedDetails.estimatedTimeInMinutes,
        distanceInKm: result.acceptedDetails.distanceInKm,
        acceptedAt: result.acceptedDetails.acceptedAt,
      } : undefined,
    };
  }

  @Mutation(() => DriverResponseResultGraphQL, {
    name: 'driverRespondToRide',
    description: 'Handle a driver accepting or rejecting a ride request',
  })
  async driverRespondToRide(@Args('input') input: DriverResponseInput): Promise<DriverResponseResultGraphQL> {
    this.logger.log(`GraphQL: Driver ${input.driverId} responded with '${input.action}' for ride ${input.rideUUID}`);
    const result = await this.matchmakingService.handleDriverResponse(input.rideUUID, input.driverId, input.action as unknown as 'accept' | 'reject');
    
    const ablyChannelId = `WG-RIDE-${input.rideUUID}-ride-details`;
    const response: DriverResponseResultGraphQL = {
      success: result.success,
      message: result.message,
      ablyChannelId,
    };

    // If accepted, fetch accept details to return in the response
    if (result.success && (input.action as unknown as string) === 'accept') {
      try {
        const acceptDetails = (result as any).acceptedDetails;
        if (acceptDetails) {
          response.acceptedDetails = {
            rideId: acceptDetails.rideId,
            rideUUId: acceptDetails.rideUUId,
            driverId: acceptDetails.driver.driverId,
            driverName: acceptDetails.driver.fullName,
            driverImage: acceptDetails.driver.profileImage || null,
            rating: acceptDetails.driver.rating || null,
            vehicleType: acceptDetails.vehicle.vehicleType || null,
            vehicleModel: acceptDetails.vehicle.vehicleModel || null,
            color: acceptDetails.vehicle.color || null,
            numberPlate: acceptDetails.vehicle.numberPlate || null,
            estimatedFare: acceptDetails.estimatedFare || null,
            estimatedTimeInMinutes: acceptDetails.estimatedTimeInMinutes || null,
            distanceInKm: acceptDetails.distanceInKm || null,
            ablyChannelId,
          };
        }
      } catch {}
    }

    return response;
  }

  @Query(() => FareBreakdownGraphQL, {
    name: 'estimatedFare', nullable: true,
    description: 'Get estimated fare for an INSTANT ride',
  })
  async estimatedFare(@Args('input') input: EstimatedFareInput): Promise<FareBreakdownGraphQL | null> {
    const fare = await this.matchmakingService.getEstimatedFare(input.rideId);
    if (!fare) return null;
    return { pickupCost: fare.pickupCost, distanceCost: fare.distanceCost, durationCost: fare.durationCost, total: fare.total };
  }

  @Query(() => ScheduledFareBreakdownGraphQL, {
    name: 'scheduledEstimatedFare', nullable: true,
    description: 'Get estimated fare for a SCHEDULED ride with optional rain/historical traffic conditions',
  })
  async scheduledEstimatedFare(@Args('input') input: ScheduledFareInput): Promise<ScheduledFareBreakdownGraphQL | null> {
    const fare = await this.matchmakingService.getScheduledEstimatedFare(input.rideId, (input.rain as unknown as RainCondition) || undefined, (input.historicalTraffic as unknown as HistoricalTraffic) || undefined);
    if (!fare) return null;
    return { baseFare: fare.baseFare,  total: fare.total };
  }

  @Mutation(() => BasicResult, {
    name: 'startRide',
    description: 'Driver starts ride - sets status to PICKUP, records rideStartedAt, publishes to Ably',
  })
  async startRide(@Args('rideId') rideId: string, @Args('driverId') driverId: string): Promise<BasicResult> {
    this.logger.log(`GraphQL: Driver ${driverId} starting ride ${rideId}`);
    const result = await this.matchmakingService.startRide(rideId, driverId);
    return result;
  }

  @Mutation(() => BasicResult, {
    name: 'pickupPassenger',
    description: 'Driver picked up passenger - sets status to ONGOING, updates destination distance',
  })
  async pickupPassenger(@Args('rideId') rideId: string, @Args('driverId') driverId: string): Promise<BasicResult> {
    this.logger.log(`GraphQL: Driver ${driverId} picked up passenger for ride ${rideId}`);
    const result = await this.matchmakingService.pickupPassenger(rideId, driverId);
    return result;
  }


  @Mutation(() => CompleteRideResult, {
    name: 'completeRide',
    description: 'Complete a ride: validates ride, updates status to COMPLETED, calculates actual duration and fare breakdown, publishes ride-completed Ably event',
  })
  async completeRide(
    @Args('rideId') rideId: string,
    @Args('driverId') driverId: string,
  ): Promise<CompleteRideResult> {
    console.log("Complete Ride called")
    const result = await this.matchmakingService.completeRide(rideId, driverId);
    if (!result.success || !result.data) {
      throw new Error(result.message || 'Failed to complete ride');
    }
    return result.data;
  }

  @Mutation(() => BasicResult, {
    name: 'subscribeToDriverLocationChannel',
    description: 'Subscribe to a driver personal location channel for continuous ride matchmaking. Call this when driver goes online.',
  })
  async subscribeToDriverLocationChannel(@Args('driverId') driverId: string): Promise<BasicResult> {
    this.logger.log(`GraphQL: Subscribing to driver ${driverId} location channel for matchmaking`);
    try {
      await this.matchmakingService.subscribeToDriverLocationChannel(driverId);
      return { success: true, message: `Subscribed to driver ${driverId} location channel` };
    } catch (err: any) {
      this.logger.error(`Failed to subscribe to driver ${driverId} location channel: ${err?.message || err}`);
      return { success: false, message: `Failed to subscribe: ${err?.message || err}` };
    }
  }

  @Mutation(() => BasicResult, {
    name: 'unsubscribeFromDriverLocationChannel',
    description: 'Unsubscribe from a driver personal location channel. Call this when driver goes offline.',
  })
  async unsubscribeFromDriverLocationChannel(@Args('driverId') driverId: string): Promise<BasicResult> {
    this.logger.log(`GraphQL: Unsubscribing from driver ${driverId} location channel`);
    try {
      await this.matchmakingService.unsubscribeFromDriverLocationChannel(driverId);
      return { success: true, message: `Unsubscribed from driver ${driverId} location channel` };
    } catch (err: any) {
      this.logger.error(`Failed to unsubscribe from driver ${driverId} location channel: ${err?.message || err}`);
      return { success: false, message: `Failed to unsubscribe: ${err?.message || err}` };
    }
  }

  @Query(() => [VehicleEstimateGraphQL], {
    name: 'getVehicleEstimates',
    description: 'Get estimates for different vehicle types',
  })
  async getVehicleEstimates(
    @Args('pickupLocation') pickup: RideLocationInput,
    @Args('dropoffLocation') dropoff: RideLocationInput,
    @Args('noOfPassengers', { type: () => Int }) noOfPassengers: number,
  ): Promise<VehicleEstimateGraphQL[]> {
    this.logger.log(`GraphQL: Getting vehicle estimates for ${noOfPassengers} passengers`);
    
    if (noOfPassengers < 1) {
      throw new BadRequestException('Minimum number of passengers is 1');
    }
    if (noOfPassengers > 4) {
      throw new BadRequestException('Maximum number of passengers is 4');
    }

    return this.matchmakingService.getVehicleEstimates({
      pickupLat: pickup.latitude,
      pickupLng: pickup.longitude,
      dropoffLat: dropoff.latitude,
      dropoffLng: dropoff.longitude,
      noOfPassengers,
    });
  }
}