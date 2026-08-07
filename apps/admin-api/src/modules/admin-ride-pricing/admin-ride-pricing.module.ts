import { Module } from "@nestjs/common";
import { AdminRidePricingPersistenceModule } from "@libs/services/admin-ride-pricing/admin-ride-pricing.persistence.module";
import { AdminRidePricingService } from "@libs/services/admin-ride-pricing/admin-ride-pricing.service";
import { AdminAuthModule } from "../auth/auth.module";
import { AdminRidePricingResolver } from "./resolver/admin-ride-pricing.resolver";

@Module({
  imports: [AdminRidePricingPersistenceModule, AdminAuthModule],
  providers: [AdminRidePricingService, AdminRidePricingResolver],
  exports: [AdminRidePricingService],
})
export class AdminRidePricingModule {}