import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { DriverDocumentService } from "../driver-document/driver-document.service";
import { VehicleService } from "../vehicle/vehicle.service";


@Injectable()
export class ImageCleanupService {
  private readonly logger = new Logger(ImageCleanupService.name);

  constructor(
    private readonly vehicleService: VehicleService,
    private readonly driverDocService: DriverDocumentService,
  ) {}

  // Runs every day at midnight
  @Cron("0 0 * * *")
  async handleMidnightCleanup(): Promise<void> {
    this.logger.log("Midnight image cleanup started");

    await this.cleanupVehicleImages();
    await this.cleanupDocumentFiles();

    this.logger.log("Midnight image cleanup completed");
  }

  private async cleanupVehicleImages(): Promise<void> {
    try {
      await this.vehicleService.deleteInactiveImages();
      this.logger.log("Vehicle inactive images cleaned");
    } catch (e) {
      this.logger.error("Vehicle image cleanup failed", e);
    }
  }

  private async cleanupDocumentFiles(): Promise<void> {
    try {
      await this.driverDocService.deleteInactiveFiles();
      this.logger.log("Driver document inactive files cleaned");
    } catch (e) {
      this.logger.error("Driver document cleanup failed", e);
    }
  }
}