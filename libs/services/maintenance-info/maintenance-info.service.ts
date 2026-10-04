import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common";
import { Message } from "@libs/localization";
import { MaintenanceInfo } from "@libs/data-access/entities/maintenance-info.entity";
import { MaintenanceInfoRepository } from "@libs/data-access/repositories/maintenance-info.repository";
import { UpsertMaintenanceInfoInput } from "@libs/data-access/dtos/input/upsert-maintenance-info.input";
import { language } from "@libs/data-access";

/**
 * Maintenance state is read on every request (guards), so it is cached for a
 * few seconds to avoid hammering mongo on every single query.
 */
const CACHE_TTL_MS = 5000;

export type MaintenanceStatus = {
  isActive: boolean;
  message: string | null;
};

@Injectable()
export class MaintenanceInfoService {
  private cachedStatus: MaintenanceStatus | null = null;
  private cacheExpiresAt = 0;
  private pendingRequest: Promise<MaintenanceStatus> | null = null;

  constructor(
    private readonly maintenanceInfoRepository: MaintenanceInfoRepository,
  ) {}

  /**
   * Returns the current maintenance status, using a short lived cache.
   */
  async getMaintenanceStatus(): Promise<MaintenanceStatus> {
    const now = Date.now();
    if (this.cachedStatus && now < this.cacheExpiresAt) {
      return this.cachedStatus;
    }

    // De-duplicate concurrent lookups so a burst of requests only hits mongo once.
    if (!this.pendingRequest) {
      this.pendingRequest = this.maintenanceInfoRepository
        .findActive()
        .then((maintenanceInfo) => {
          const status: MaintenanceStatus = {
            isActive: !!maintenanceInfo,
            message: maintenanceInfo?.message ?? null,
          };
          this.cachedStatus = status;
          this.cacheExpiresAt = Date.now() + CACHE_TTL_MS;
          return status;
        })
        .finally(() => {
          this.pendingRequest = null;
        });
    }

    return this.pendingRequest;
  }

  /**
   * Throws HTTP 503 with the maintenance message when the app is under
   * maintenance. Returns silently otherwise.
   */
  async assertNotInMaintenance(lang: string = language.EN): Promise<void> {
    const { isActive, message } = await this.getMaintenanceStatus();
    if (!isActive) {
      return;
    }

    throw new HttpException(
      {
        message:
          message || Message(lang, "MAINTENANCE_INFO.SERVICE_UNAVAILABLE"),
        error: "Service Unavailable",
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        isMaintenance: true,
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  /** Clears the cached maintenance status (called after admin updates it). */
  clearCache(): void {
    this.cachedStatus = null;
    this.cacheExpiresAt = 0;
  }

  async getMaintenanceInfo(): Promise<MaintenanceInfo> {
    const maintenanceInfo = await this.maintenanceInfoRepository.findFirst();
    if (!maintenanceInfo) {
      ErrorException(
        null,
        "MAINTENANCE_INFO.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }
    return maintenanceInfo.toObject() as MaintenanceInfo;
  }

  async upsert(input: UpsertMaintenanceInfoInput): Promise<MaintenanceInfo> {
    const maintenanceInfo = await this.maintenanceInfoRepository.upsert({
      message: input.message,
      isActive: input.isActive === undefined ? true : input.isActive,
    });
    // Make the change effective immediately instead of waiting for the TTL.
    this.clearCache();
    return maintenanceInfo.toObject() as MaintenanceInfo;
  }
}