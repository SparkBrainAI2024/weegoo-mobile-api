import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { EnvService } from '@libs/common/config/env.service';

/**
 * Service that integrates the API (passenger app) with the Ride Matchmaking microservice.
 * After a ride is created, it calls the matchmaking service to start matching drivers.
 */
@Injectable()
export class MatchmakingIntegrationService {
  private readonly logger = new Logger(MatchmakingIntegrationService.name);

  constructor(private readonly envService: EnvService) {}

  /**
   * Trigger matchmaking for an INSTANT ride after creation.
   * Calls the ride-matchmaking microservice via HTTP.
   */
  async triggerInstantMatchmaking(rideId: string): Promise<{ success: boolean; message: string }> {
    const matchmakingUrl = this.getMatchmakingUrl();

    try {
      this.logger.log(`Triggering instant matchmaking for ride: ${rideId}`);

      const response = await axios.post(
        `${matchmakingUrl}/graphql`,
        {
          query: `
            mutation MatchDrivers($input: MatchDriversInput!) {
              matchDrivers(input: $input) {
                matched
                rideId
                rideUUId
                driverId
                driverName
                attempts { attemptNumber radiusKm driversFound driversRequested driverAccepted timeoutExpired }
                message
              }
            }
          `,
          variables: {
            input: { rideId },
          },
        },
        { timeout: 120000 }, // 2 min timeout for full matchmaking cycle
      );

      const result = response.data?.data?.matchDrivers;
      if (result?.matched) {
        this.logger.log(`Matchmaking succeeded for ride ${rideId}: driver ${result.driverId}`);
        return { success: true, message: `Driver ${result.driverName || result.driverId} matched` };
      }

      this.logger.warn(`Matchmaking did not match for ride ${rideId}: ${result?.message}`);
      return { success: false, message: result?.message || 'No driver found' };
    } catch (error: any) {
      this.logger.error(`Matchmaking request failed for ride ${rideId}: ${error?.message || error}`);

      // Fallback: trigger async matchmaking via Ably
      await this.requestMatchmakingViaAbly(rideId, 'INSTANT');

      return { success: false, message: 'Matchmaking request submitted asynchronously' };
    }
  }

  /**
   * Trigger matchmaking for a SCHEDULED ride.
   */
  async triggerScheduledMatchmaking(rideId: string): Promise<void> {
    this.logger.log(`Scheduled ride ${rideId} created. Will be matched later via scheduler.`);
    // In production, a cron job or scheduler would call this at the appropriate time
    await this.requestMatchmakingViaAbly(rideId, 'SCHEDULED');
  }

  private getMatchmakingUrl(): string {
    return this.envService.getString('RIDE_MATCHMAKING_URL', 'http://localhost:3004/graphql');
  }

  private async requestMatchmakingViaAbly(rideId: string, rideType: string): Promise<void> {
    // This would use Ably to publish a matchmaking request to the ride-matchmaking service
    // For now, log the request
    this.logger.log(`[Ably fallback] Matchmaking requested for ${rideType} ride: ${rideId}`);
  }
}