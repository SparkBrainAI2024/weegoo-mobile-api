import { Controller, Get, Param, BadRequestException } from '@nestjs/common';
import { CronService } from './cron.service';

/**
 * REST endpoints for the headless cron app.
 *
 * - GET /            -> liveness probe
 * - GET /health      -> health check
 * - GET /cron/run/:jobName -> manually trigger a cron job (QA testing)
 *
 * The manual trigger endpoint is useful for QA / operators to run a scheduled
 * job on demand without waiting for the cron schedule to fire. It uses GET so
 * it can be triggered directly from a browser address bar.
 */
@Controller()
export class HealthController {
  constructor(private readonly cronService: CronService) {}

  @Get()
  root() {
    return {
      status: 'ok',
      service: 'cron',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'healthy',
      service: 'cron',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Manually trigger a cron job by name. Used for QA testing.
   * Uses GET so it can be triggered directly from a browser.
   *
   * Supported job names:
   *  - "cleanupStaleOfflineDrivers" -> stale-driver sweep
   *  - "handleMidnightCleanup"      -> S3 image/document cleanup
   *  - "handleExpiredAvailabilityCleanup" -> past availability-day cleanup
   */
  @Get('cron/run/:jobName')
  async runCronJob(
    @Param('jobName') jobName: string,
  ): Promise<{ success: boolean; job: string; result?: any; message?: string }> {
    switch (jobName) {
      case 'cleanupStaleOfflineDrivers':
        return {
          success: true,
          job: jobName,
          result: await this.cronService.cleanupStaleOfflineDrivers(),
        };
      case 'handleMidnightCleanup':
        await this.cronService.handleMidnightCleanup();
        return { success: true, job: jobName };
      case 'handleExpiredAvailabilityCleanup':
        return {
          success: true,
          job: jobName,
          result: await this.cronService.handleExpiredAvailabilityCleanup(),
        };
      default:
        throw new BadRequestException(
          `Unknown cron job "${jobName}". Supported jobs: cleanupStaleOfflineDrivers, handleMidnightCleanup, handleExpiredAvailabilityCleanup`,
        );
    }
  }
}