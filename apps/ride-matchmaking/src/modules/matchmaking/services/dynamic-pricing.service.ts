import { Injectable, Logger } from '@nestjs/common';
import {
  MATCHMAKING_CONFIG,
  FareBreakdown,
  WeatherCondition,
  TrafficCondition,
  RainCondition,
  HistoricalTraffic,
  ScheduledFareBreakdown,
} from '../config/matchmaking.config';

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  /**
   * Calculate the estimated fare for an INSTANT ride (additive model).
   *
   * Formula:
   *   pickup_cost         = $1.0
   *   distance_km * 1.2   = distanceCost
   *   duration_min * 0.3  = durationCost
   *   subtotal = pickup + distance + duration
   *   weather surcharge   = subtotal × (weatherMultiplier - 1)
   *   traffic surcharge   = subtotal × (trafficMultiplier - 1)
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

    this.logger.debug(`[INSTANT] Fare calculated: ${JSON.stringify(fare)}`);
    return fare;
  }

  /**
   * Calculate the estimated fare for a SCHEDULED ride (multiplicative model).
   *
   * Formula:
   *   Base fare = (distance_km × per_km_rate) + (time_min × per_min_rate)
   *   Ride type multiplier:  car × 1.0, bike × 0.7
   *   Rain multiplier:       light × 1.1, heavy × 1.3
   *   Traffic multiplier:    moderate × 1.2, heavy × 1.4
   *
   *   Final = Base fare × ride_multiplier × rain_multiplier × traffic_multiplier
   */
  calculateScheduledFare(params: {
    distanceKm: number;
    durationMinutes: number;
    vehicleType: string;
    rain?: RainCondition;
    historicalTraffic?: HistoricalTraffic;
  }): ScheduledFareBreakdown {
    const {
      distanceKm,
      durationMinutes,
      vehicleType,
      rain = 'none',
      historicalTraffic = 'low',
    } = params;

    const { SCHEDULED_FARE } = MATCHMAKING_CONFIG;

    // Base fare = (distance_km × per_km_rate) + (time_min × per_min_rate)
    // Note: No separate pickup cost in scheduled — simplified
    const baseFare =
      distanceKm * SCHEDULED_FARE.PER_KM_RATE +
      durationMinutes * SCHEDULED_FARE.PER_MINUTE_RATE;

    // Ride type multiplier
    const rideTypeMultiplier =
      SCHEDULED_FARE.RIDE_TYPE_MULTIPLIER[vehicleType] || 1.0;

    // Rain multiplier (based on forecast at scheduled time)
    const rainMultiplier =
      rain !== 'none'
        ? SCHEDULED_FARE.RAIN_MULTIPLIER[rain] || 1.0
        : 1.0;

    // Traffic multiplier (based on historical traffic at scheduled time)
    const trafficMultiplier =
      historicalTraffic !== 'low'
        ? SCHEDULED_FARE.SCHEDULED_TRAFFIC_MULTIPLIER[historicalTraffic] || 1.0
        : 1.0;

    // Final = Base fare × ride_mult × rain_mult × traffic_mult
    const total = baseFare * rideTypeMultiplier * rainMultiplier * trafficMultiplier;

    const fare: ScheduledFareBreakdown = {
      baseFare: this.round(baseFare),
      rideTypeMultiplier,
      rainMultiplier,
      trafficMultiplier,
      total: this.round(total),
    };

    this.logger.debug(`[SCHEDULED] Fare calculated: ${JSON.stringify(fare)}`);
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