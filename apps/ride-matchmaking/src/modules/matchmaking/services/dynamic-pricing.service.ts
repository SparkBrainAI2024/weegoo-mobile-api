import { Injectable, Logger } from '@nestjs/common';
import {
  FareBreakdown,
  ScheduledFareBreakdown,
} from '@libs/data-access';
import { MATCHMAKING_CONFIG } from '@libs/common';

@Injectable()
export class DynamicPricingService {
  private readonly logger = new Logger(DynamicPricingService.name);

  /**
   * Calculate the estimated fare for an INSTANT ride.
   * total = pickupCost + distanceCost + durationCost
   * Uses vehicle-specific rates from MATCHMAKING_CONFIG
   */
  calculateFare(params: {
    distanceKm: number;
    durationMinutes: number;
    vehicleType?: string;
  }): FareBreakdown {
    const { distanceKm, durationMinutes, vehicleType = 'CAR' } = params;
    const { FARE } = MATCHMAKING_CONFIG;

    // Get vehicle-specific rates (fallback to CAR if type not found)
    const basePickupCost = FARE.BASE_PICKUP_COST[vehicleType] || FARE.BASE_PICKUP_COST['CAR'];
    const perKmRate = FARE.PER_KM_RATE[vehicleType] || FARE.PER_KM_RATE['CAR'];
    const perMinuteRate = FARE.PER_MINUTE_RATE[vehicleType] || FARE.PER_MINUTE_RATE['CAR'];

    const pickupCost = basePickupCost;
    const distanceCost = distanceKm * perKmRate;
    const durationCost = durationMinutes * perMinuteRate;
    const total = pickupCost + distanceCost + durationCost;

    const fare: FareBreakdown = {
      pickupCost: this.round(pickupCost),
      distanceCost: this.round(distanceCost),
      durationCost: this.round(durationCost),
      total: this.round(total),
      baseFare:this.round(pickupCost)
    };

    this.logger.debug(`[INSTANT][${vehicleType}] Fare calculated: ${JSON.stringify(fare)}`);
    return fare;
  }

  /**
   * Calculate the estimated fare for a SCHEDULED ride (multiplicative model).
   * Final = (basePickupCost + distanceCost + durationCost) × ride_mult
   * Uses vehicle-specific rates from MATCHMAKING_CONFIG
   */
  calculateScheduledFare(params: {
    distanceKm: number;
    durationMinutes: number;
    vehicleType: string;
  }): ScheduledFareBreakdown {
    const {
      distanceKm,
      durationMinutes,
      vehicleType,
    } = params;

    const { SCHEDULED_FARE } = MATCHMAKING_CONFIG;

    // Get vehicle-specific rates (fallback to CAR if type not found)
    const basePickupCost = SCHEDULED_FARE.BASE_PICKUP_COST[vehicleType] || SCHEDULED_FARE.BASE_PICKUP_COST['CAR'];
    const perKmRate = SCHEDULED_FARE.PER_KM_RATE[vehicleType] || SCHEDULED_FARE.PER_KM_RATE['CAR'];
    const perMinuteRate = SCHEDULED_FARE.PER_MINUTE_RATE[vehicleType] || SCHEDULED_FARE.PER_MINUTE_RATE['CAR'];
     const distanceCost =  distanceKm * perKmRate 
    const durationCost=durationMinutes * perMinuteRate;
    const baseFare =
      basePickupCost +
      distanceKm * perKmRate +
      durationMinutes * perMinuteRate;

    const rideTypeMultiplier =
      SCHEDULED_FARE.RIDE_TYPE_MULTIPLIER[vehicleType] || 1.0;

    const total = baseFare * rideTypeMultiplier;

    const fare: ScheduledFareBreakdown = {
      baseFare: this.round(baseFare),
      total: this.round(total),
      distanceCost: this.round(distanceCost),
      durationCost: this.round(durationCost),
      pickupCost: this.round(basePickupCost),
};

    this.logger.debug(`[SCHEDULED][${vehicleType}] Fare calculated: ${JSON.stringify(fare)}`);
    return fare;
  }

  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}