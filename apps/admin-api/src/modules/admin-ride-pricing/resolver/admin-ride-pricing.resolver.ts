import { UseGuards } from "@nestjs/common";
import { Args, Mutation, Query, Resolver } from "@nestjs/graphql";
import { AdminAuthGuard } from "@libs/guards/auth.admin.guard";
import { AdminRidePricing } from "@libs/data-access/entities/admin-ride-pricing.entity";
import { UpsertAdminRidePricingInput } from "@libs/data-access/dtos/input/upsert-admin-ride-pricing.input";
import { AdminRidePricingService } from "@libs/services/admin-ride-pricing/admin-ride-pricing.service";
import { VehicleType } from "@libs/data-access/enums/vehicle.enum";

@UseGuards(AdminAuthGuard)
@Resolver(() => AdminRidePricing)
export class AdminRidePricingResolver {
  constructor(
    private readonly adminRidePricingService: AdminRidePricingService,
  ) {}

  @Query(() => [AdminRidePricing], { name: "adminRidePricings" })
  async getAllPricing(): Promise<AdminRidePricing[]> {
    return this.adminRidePricingService.findAll();
  }

  @Query(() => AdminRidePricing, { name: "adminRidePricing" })
  async getPricingByVehicleType(
    @Args("vehicleType", { type: () => VehicleType }) vehicleType: VehicleType,
  ): Promise<AdminRidePricing> {
    return this.adminRidePricingService.findByVehicleType(vehicleType);
  }

  @Mutation(() => AdminRidePricing)
  async upsertAdminRidePricing(
    @Args("input") input: UpsertAdminRidePricingInput,
  ): Promise<AdminRidePricing> {
    return this.adminRidePricingService.upsert(input);
  }
}