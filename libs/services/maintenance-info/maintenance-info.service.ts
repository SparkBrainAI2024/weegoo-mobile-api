import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common";
import { MaintenanceInfo } from "@libs/data-access/entities/maintenance-info.entity";
import { MaintenanceInfoRepository } from "@libs/data-access/repositories/maintenance-info.repository";
import { UpsertMaintenanceInfoInput } from "@libs/data-access/dtos/input/upsert-maintenance-info.input";

@Injectable()
export class MaintenanceInfoService {
  constructor(
    private readonly maintenanceInfoRepository: MaintenanceInfoRepository,
  ) {}

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
    });
    return maintenanceInfo.toObject() as MaintenanceInfo;
  }
}