import { Injectable, Logger } from '@nestjs/common';
import {
  MATCHMAKING_CONFIG,
  FareBreakdown,
  WeatherCondition,
  TrafficCondition,
} from '../config/matchmaking.config';

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  /**
   * Calculate the estimated fare for a ride based on distance, duration,
   * weather conditions, and traffic conditions.
   *
   * Formula:
   *   pickup_cost         = $1.0
   *   distance_km * 1.2   = distanceCost
   *   duration_min * 0.3  = durationCost
   *   subtotal = pickup + distance + duration
   *
   *   weather surcharge   = subtotal * weatherMultiplier (e.g. heavy rain +25% for car)
   *   traffic surcharge   = subtotal * trafficMultiplier (e.g. severe traffic +30% for car)
   *
   *   total = subtotal + weatherSurcharge + trafficSurcharge
   */
  calculateFare(params: {
    distanceKm: number;
    durationMinutes: number;
    vehicleType: string;
    weather?: WeatherCondition;
    traffic?: TrafficCondition;
  }): FareBreakdown {
    const {
      distanceKm,
      durationMinutes,
      vehicleType,
      weather = 'none',
      traffic = 'low',
    } = params;

    const { FARE } = MATCHMAKING_CONFIG;

    // Base costs
    const pickupCost = FARE.BASE_PICKUP_COST;
    const distanceCost = distanceKm * FARE.PER_KM_RATE;
    const durationCost = durationMinutes * FARE.PER_MINUTE_RATE;
    const subtotal = pickupCost + distanceCost + durationCost;

    // Weather surcharge
    const weatherMultiplier =
      weather !== 'none'
        ? MATCHMAKING_CONFIG.WEATHER_MULTIPLIERS[vehicleType]?.[weather] || 1.0
        : 1.0;
    const weatherSurchargePercent = (weatherMultiplier - 1) * 100;
    const weatherSurcharge = subtotal * (weatherMultiplier - 1);

    // Traffic surcharge
    const trafficMultiplier =
      traffic !== 'low'
        ? MATCHMAKING_CONFIG.TRAFFIC_MULTIPLIERS[vehicleType]?.[traffic] || 1.0
        : 1.0;
    const trafficSurchargePercent = (trafficMultiplier - 1) * 100;
    const trafficSurcharge = subtotal * (trafficMultiplier - 1);

    const total = subtotal + weatherSurcharge + trafficSurcharge;

    const fare: FareBreakdown = {
      pickupCost: this.round(pickupCost),
      distanceCost: this.round(distanceCost),
      durationCost: this.round(durationCost),
      subtotal: this.round(subtotal),
      weatherSurcharge: this.round(weatherSurcharge),
      weatherSurchargePercent: this.round(weatherSurchargePercent),
      trafficSurcharge: this.round(trafficSurcharge),
      trafficSurchargePercent: this.round(trafficSurchargePercent),
      total: this.round(total),
    };

    this.logger.debug(`Fare calculated: ${JSON.stringify(fare)}`);
    return fare;
  }

  /**
   * Check if we should suggest switching vehicle type (e.g. rain + bike -> car)
   */
  getSuggestedVehicleType(
    requestedType: string,
    weather?: WeatherCondition,
  ): string | null {
    if (
      weather === 'heavy' &&
      (requestedType === 'MOTORBIKE' || requestedType === 'SCOOTER')
    ) {
      return 'CAR';
    }
    return null;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}