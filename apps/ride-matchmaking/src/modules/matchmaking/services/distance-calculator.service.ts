import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';
import { VehicleType } from '@libs/data-access';

export interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  polyline?: string;
}

@Injectable()
export class DistanceCalculatorService {
  private readonly logger = new Logger(DistanceCalculatorService.name);

  constructor(private readonly envService: EnvService) { }

  /**
   * Calculate distance and duration between two coordinates using Baato API.
   * Baato is a Nepal-based mapping and routing service.
   *
   * API Format: https://api.baato.io/api/v1/directions?key=YOUR_KEY&points[]=lat,lng&points[]=lat,lng&mode=car
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
    requestedType: string,
  ): Promise<DistanceResult> {
    const apiKey = this.envService.getBaatoApiKey();
    const baseUrl = this.envService.getBaatoApiUrl();

    if (!apiKey) {
      this.logger.warn('Baato API key not configured. Using fallback Haversine calculation.');
      return this.haversineFallback(originLat, originLng, destLat, destLng);
    }

    try {
      this.logger.log(`Calling Baato API for distance calculation: origin (${originLat},${originLng}), destination (${destLat},${destLng}),${baseUrl} ${apiKey}`);
      const params = new URLSearchParams();
      params.append('key', `${apiKey}`);
      params.append('points[]', `${originLat},${originLng}`);
      params.append('points[]', `${destLat},${destLng}`);
      params.append('mode', requestedType === VehicleType.CAR.toLocaleLowerCase() ? 'car' : requestedType.toLocaleLowerCase() === VehicleType.MOTORBIKE ? 'bike' : 'bike');
      // Baato API format: points[]=lat,lng
      this.logger.debug(`Baato API request params: ${params.toString()}`);
      const queryString = params.toString();

      this.logger.log(
        `${baseUrl}/directions?${queryString}`,
      );
      const response = await axios.get(`${baseUrl}/directions`, {
        params: params,
      });
        this.logger.debug(`Baato API response: ${response.toString()}`);
      const route = response.data?.data?.[0];
      if (route) {
        return {
          distanceKm: route.distanceInMeters / 1000,
          durationMinutes: Math.ceil(route.timeInMs / 1000 / 60),
          polyline: route.encodedPolyline,
        };
      }

      // Fallback if no route found
      return this.haversineFallback(originLat, originLng, destLat, destLng);
    } catch (error: any) {
      this.logger.error(`Baato API error: ${error}. Using Haversine fallback.`);
      return this.haversineFallback(originLat, originLng, destLat, destLng);
    }
  }

  /**
   * Calculate distance from pickup to a driver's location using Baato API.
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
    requestedType: string,
  ): Promise<DistanceResult> {
    return this.calculateDistance(pickupLat, pickupLng, driverLat, driverLng, requestedType);
  }

  /**
   * Haversine formula fallback when Baato API is unavailable.
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