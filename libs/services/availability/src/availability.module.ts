import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { AdminRidePricingPersistenceModule } from "@libs/services/admin-ride-pricing/admin-ride-pricing.persistence.module";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { AvailabilityPersistentModule } from "./availability-persistent.module";
import { AvailabilityService } from "./availability.service";
import { AvailabilityResolver } from "./availability.resolver";

@Module({
  imports: [
    AvailabilityPersistentModule,
    UserPersistenceModule,
    // Provides AdminRidePricingService — the source of truth for the system
    // fares used by scheduled availability amounts and the systemFare resolver.
    AdminRidePricingPersistenceModule,
  ],
  providers: [AvailabilityService, AvailabilityResolver, EnvService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}