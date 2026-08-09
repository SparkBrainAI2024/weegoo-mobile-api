import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminRidePricing, AdminRidePricingSchema } from "@libs/data-access/entities/admin-ride-pricing.entity";
import { AdminRidePricingRepository } from "@libs/data-access/repositories/admin-ride-pricing.repository";
import { AdminRidePricingService } from "./admin-ride-pricing.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminRidePricing.name, schema: AdminRidePricingSchema },
    ]),
  ],
  providers: [AdminRidePricingRepository, AdminRidePricingService],
  exports: [AdminRidePricingService, AdminRidePricingRepository, MongooseModule],
})
export class AdminRidePricingPersistenceModule {}