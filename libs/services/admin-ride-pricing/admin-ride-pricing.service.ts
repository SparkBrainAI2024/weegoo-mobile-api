import { HttpStatus, Injectable } from "@nestjs/common";
import { ErrorException } from "@libs/common";
import { AdminRidePricing } from "@libs/data-access/entities/admin-ride-pricing.entity";
import { AdminRidePricingRepository } from "@libs/data-access/repositories/admin-ride-pricing.repository";
import { UpsertAdminRidePricingInput } from "@libs/data-access/dtos/input/upsert-admin-ride-pricing.input";
import { VehicleType } from "@libs/data-access/enums/vehicle.enum";

@Injectable()
export class AdminRidePricingService {
  constructor(
    private readonly adminRidePricingRepository: AdminRidePricingRepository,
  ) {}

  async findAll(): Promise<AdminRidePricing[]> {
    const pricingList = await this.adminRidePricingRepository.findAllPricing();
    return pricingList.map((pricing) => pricing.toObject() as AdminRidePricing);
  }

  async findByVehicleType(vehicleType: VehicleType): Promise<AdminRidePricing> {
    const pricing = await this.adminRidePricingRepository.findByVehicleType(
      vehicleType,
    );
    if (!pricing) {
      ErrorException(
        null,
        "ADMIN_RIDE_PRICING.NOT_FOUND",
        HttpStatus.NOT_FOUND,
      );
    }
    return pricing.toObject() as AdminRidePricing;
  }

  async upsert(input: UpsertAdminRidePricingInput): Promise<AdminRidePricing> {
    const pricing = await this.adminRidePricingRepository.upsertByVehicleType(
      input.vehicleType,
      {
        vehicleType: input.vehicleType,
        commission: input.commission,
        baseFare: input.baseFare,
        amountPerKm: input.amountPerKm,
        amountPerMinute: input.amountPerMinute,
      },
    );
    return pricing.toObject() as AdminRidePricing;
  }
}