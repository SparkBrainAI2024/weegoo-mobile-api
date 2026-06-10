import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import {
  MatchResultGraphQL,
  DriverResponseResultGraphQL,
  FareBreakdownGraphQL,
  ScheduledMatchResultGraphQL,
  ScheduledFareBreakdownGraphQL,
  LocationUpdateResultGraphQL,
  MatchDriversInput,
  MatchScheduledDriversInput,
  DriverResponseInput,
  EstimatedFareInput,
  ScheduledFareInput,
  UpdateDriverLocationInput,
  UpdatePassengerLocationInput,
  RainCondition, 
  HistoricalTraffic
} from '@libs/data-access';



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
    };
  }

  @Mutation(() => DriverResponseResultGraphQL, {
    name: 'driverRespondToRide',
    description: 'Handle a driver accepting or rejecting a ride request',
  })
  async driverRespondToRide(@Args('input') input: DriverResponseInput): Promise<DriverResponseResultGraphQL> {
    this.logger.log(`GraphQL: Driver ${input.driverId} responded with '${input.action}' for ride ${input.rideUUID}`);
    const result = await this.matchmakingService.handleDriverResponse(input.rideUUID, input.driverId, input.action as unknown as 'accept' | 'reject');
    return { success: result.success, message: result.message };
  }

  @Mutation(() => LocationUpdateResultGraphQL, {
    name: 'updateDriverLocation',
    description: 'Update a driver current geo-location for real-time proximity matching',
  })
  async updateDriverLocation(@Args('input') input: UpdateDriverLocationInput): Promise<LocationUpdateResultGraphQL> {
    this.logger.log(`GraphQL: Updating location for driver ${input.driverId}`);
    const result = await this.matchmakingService.updateDriverLocation(input.driverId, input.latitude, input.longitude);
    return { success: result.success, message: result.message, latitude: input.latitude, longitude: input.longitude, updatedAt: new Date().toISOString() };
  }

  @Mutation(() => LocationUpdateResultGraphQL, {
    name: 'updatePassengerLocation',
    description: 'Update a passenger current geo-location for real-time tracking',
  })
  async updatePassengerLocation(@Args('input') input: UpdatePassengerLocationInput): Promise<LocationUpdateResultGraphQL> {
    this.logger.log(`GraphQL: Updating location for passenger ${input.passengerId}`);
    const result = await this.matchmakingService.updatePassengerLocation(input.passengerId, input.latitude, input.longitude);
    return { success: result.success, message: result.message, latitude: input.latitude, longitude: input.longitude, updatedAt: new Date().toISOString() };
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
}