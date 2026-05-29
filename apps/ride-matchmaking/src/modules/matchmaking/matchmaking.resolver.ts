import { Resolver, Mutation, Query, Args } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { MatchmakingService } from './matchmaking.service';
import { MatchResultGraphQL, DriverResponseResultGraphQL, FareBreakdownGraphQL } from './dto/matchmaking-response.dto';
import {
  MatchDriversInput,
  DriverResponseInput,
  EstimatedFareInput,
  WeatherConditionEnum,
  TrafficConditionEnum,
  DriverActionEnum,
} from './dto/matchmaking-input.dto';
import { WeatherCondition, TrafficCondition } from './config/matchmaking.config';

@Resolver()
export class MatchmakingResolver {
  private readonly logger = new Logger(MatchmakingResolver.name);

  constructor(private readonly matchmakingService: MatchmakingService) {}

  /**
   * Start the matchmaking process for a ride.
   * Uses the expanding-ring algorithm to find and notify nearby drivers.
   */
  @Mutation(() => MatchResultGraphQL, {
    name: 'matchDrivers',
    description: 'Find and notify nearby drivers for a ride using expanding-ring algorithm',
  })
  async matchDrivers(
    @Args('input') input: MatchDriversInput,
  ): Promise<MatchResultGraphQL> {
    this.logger.log(`GraphQL: Matchmaking triggered for ride: ${input.rideId}`);

    const result = await this.matchmakingService.matchDrivers({
      rideId: input.rideId,
      weather: input.weather as unknown as WeatherCondition || undefined,
      traffic: input.traffic as unknown as TrafficCondition || undefined,
    });

    return {
      matched: result.matched,
      rideId: result.rideId,
      rideUUId: result.rideUUId,
      passengerId: result.passengerId,
      driverId: result.driverId,
      driverName: result.driverName,
      estimatedFare: result.estimatedFare
        ? {
            pickupCost: result.estimatedFare.pickupCost,
            distanceCost: result.estimatedFare.distanceCost,
            durationCost: result.estimatedFare.durationCost,
            subtotal: result.estimatedFare.subtotal,
            weatherSurcharge: result.estimatedFare.weatherSurcharge,
            weatherSurchargePercent: result.estimatedFare.weatherSurchargePercent,
            trafficSurcharge: result.estimatedFare.trafficSurcharge,
            trafficSurchargePercent: result.estimatedFare.trafficSurchargePercent,
            total: result.estimatedFare.total,
          }
        : undefined,
      attempts: result.attempts.map((a) => ({
        attemptNumber: a.attemptNumber,
        radiusKm: a.radiusKm,
        waitTimeSeconds: a.waitTimeSeconds,
        driversFound: a.driversFound,
        driversRequested: a.driversRequested,
        driverAccepted: a.driverAccepted,
        acceptedDriverId: a.acceptedDriverId,
        timeoutExpired: a.timeoutExpired,
      })),
      message: result.message,
    };
  }

  /**
   * Handle a driver's response to a ride request (accept/reject).
   */
  @Mutation(() => DriverResponseResultGraphQL, {
    name: 'driverRespondToRide',
    description: 'Handle a driver accepting or rejecting a ride request',
  })
  async driverRespondToRide(
    @Args('input') input: DriverResponseInput,
  ): Promise<DriverResponseResultGraphQL> {
    this.logger.log(
      `GraphQL: Driver ${input.driverId} responded with '${input.action}' for ride ${input.rideId}`,
    );

    const result = await this.matchmakingService.handleDriverResponse(
      input.rideId,
      input.driverId,
      input.action as unknown as 'accept' | 'reject',
    );

    return {
      success: result.success,
      message: result.message,
    };
  }

  /**
   * Get the estimated fare for a ride (for pre-match display).
   * Useful for showing users the price before matching.
   */
  @Query(() => FareBreakdownGraphQL, {
    name: 'estimatedFare',
    nullable: true,
    description: 'Get estimated fare for a ride with optional weather/traffic conditions',
  })
  async estimatedFare(
    @Args('input') input: EstimatedFareInput,
  ): Promise<FareBreakdownGraphQL | null> {
    const fare = await this.matchmakingService.getEstimatedFare(
      input.rideId,
      input.weather as unknown as WeatherCondition || undefined,
      input.traffic as unknown as TrafficCondition || undefined,
    );

    if (!fare) return null;

    return {
      pickupCost: fare.pickupCost,
      distanceCost: fare.distanceCost,
      durationCost: fare.durationCost,
      subtotal: fare.subtotal,
      weatherSurcharge: fare.weatherSurcharge,
      weatherSurchargePercent: fare.weatherSurchargePercent,
      trafficSurcharge: fare.trafficSurcharge,
      trafficSurchargePercent: fare.trafficSurchargePercent,
      total: fare.total,
    };
  }
}