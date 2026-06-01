import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  polyline?: string;
}

@Injectable()
export class DistanceCalculatorService {
  private readonly logger = new Logger(DistanceCalculatorService.name);

  constructor(private readonly envService: EnvService) {}

  /**
   * Calculate distance and duration between two coordinates using Batoo API.
   * Batoo is a Nepal-based mapping and routing service.
   *
   * @param originLat - Origin latitude
   * @param originLng - Origin longitude
   * @param destLat - Destination latitude
   * @param destLng - Destination longitude
   */
  async calculateDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<DistanceResult> {
    const apiKey = this.envService.getBatooApiKey();
    const baseUrl = this.envService.getBatooApiUrl();

    if (!apiKey) {
      this.logger.warn('Batoo API key not configured. Using fallback Haversine calculation.');
      return this.haversineFallback(originLat, originLng, destLat, destLng);
    }

    try {
      const response = await axios.get(`${baseUrl}/directions`, {
        params: {
          origin: `${originLat},${originLng}`,
          destination: `${destLat},${destLng}`,
          alternatives: false,
          key: apiKey,
        },
        timeout: 5000,
      });

      const route = response.data?.routes?.[0];
      if (route) {
        return {
          distanceKm: route.distance / 1000, // convert meters to km
          durationMinutes: Math.ceil(route.duration / 60), // convert seconds to minutes
          polyline: route.polyline?.encodedPolyline,
        };
      }

      // Fallback if no route found
      return this.haversineFallback(originLat, originLng, destLat, destLng);
    } catch (error: any) {
      this.logger.error(`Batoo API error: ${error?.message || error}. Using Haversine fallback.`);
      return this.haversineFallback(originLat, originLng, destLat, destLng);
    }
  }

  /**
   * Calculate straight-line distance from pickup to a driver's location using Batoo API.
   * Used for the initial driver proximity check during matching.
   *
   * @param pickupLat - Pickup latitude
   * @param pickupLng - Pickup longitude
   * @param driverLat - Driver's current latitude
   * @param driverLng - Driver's current longitude
   */
  async calculateDriverDistance(
    pickupLat: number,
    pickupLng: number,
    driverLat: number,
    driverLng: number,
  ): Promise<DistanceResult> {
    return this.calculateDistance(pickupLat, pickupLng, driverLat, driverLng);
  }

  /**
   * Haversine formula fallback when Batoo API is unavailable.
   * Calculates great-circle distance between two points.
   */
  private haversineFallback(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): DistanceResult {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;

    // Estimate duration: assume avg 30 km/h in city
    const estimatedSpeedKmph = 30;
    const durationMinutes = Math.ceil((distanceKm / estimatedSpeedKmph) * 60);

    return { distanceKm, durationMinutes };
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}