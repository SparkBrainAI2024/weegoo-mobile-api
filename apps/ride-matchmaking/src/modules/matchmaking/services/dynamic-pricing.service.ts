import { Injectable, Logger } from '@nestjs/common';
import {
  FareBreakdown,
  RainCondition,
  HistoricalTraffic,
  ScheduledFareBreakdown,
} from '@libs/data-access';
import { MATCHMAKING_CONFIG } from '@libs/common';

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  /**
   * Calculate the estimated fare for an INSTANT ride.
   * total = pickupCost + distanceCost + durationCost
   */
  calculateFare(params: {
    distanceKm: number;
    durationMinutes: number;
  }): FareBreakdown {
    const { distanceKm, durationMinutes } = params;
    const { FARE } = MATCHMAKING_CONFIG;

    const pickupCost = FARE.BASE_PICKUP_COST;
    const distanceCost = distanceKm * FARE.PER_KM_RATE;
    const durationCost = durationMinutes * FARE.PER_MINUTE_RATE;
    const total = pickupCost + distanceCost + durationCost;

    const fare: FareBreakdown = {
      pickupCost: this.round(pickupCost),
      distanceCost: this.round(distanceCost),
      durationCost: this.round(durationCost),
      total: this.round(total),
    };

    this.logger.debug(`[INSTANT] Fare calculated: ${JSON.stringify(fare)}`);
    return fare;
  }

  /**
   * Calculate the estimated fare for a SCHEDULED ride (multiplicative model).
   * Final = Base fare × ride_mult × rain_mult × traffic_mult
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

    const baseFare =
      distanceKm * SCHEDULED_FARE.PER_KM_RATE +
      durationMinutes * SCHEDULED_FARE.PER_MINUTE_RATE;

    const rideTypeMultiplier =
      SCHEDULED_FARE.RIDE_TYPE_MULTIPLIER[vehicleType] || 1.0;

    const rainMultiplier =
      rain !== 'none'
        ? SCHEDULED_FARE.RAIN_MULTIPLIER[rain] || 1.0
        : 1.0;

    const trafficMultiplier =
      historicalTraffic !== 'low'
        ? SCHEDULED_FARE.SCHEDULED_TRAFFIC_MULTIPLIER[historicalTraffic] || 1.0
        : 1.0;

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

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}