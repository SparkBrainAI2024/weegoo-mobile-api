import { Module } from "@nestjs/common";
import { AdminRidePricingPersistenceModule } from "@libs/services/admin-ride-pricing/admin-ride-pricing.persistence.module";
import { AdminRidePricingService } from "@libs/services/admin-ride-pricing/admin-ride-pricing.service";
import { AdminAuthModule } from "../auth/auth.module";
import { AdminRidePricingResolver } from "./resolver/admin-ride-pricing.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [AdminRidePricingPersistenceModule, AdminAuthModule,UserPersistenceModule],
  providers: [AdminRidePricingService, AdminRidePricingResolver,EnvService],
  exports: [AdminRidePricingService],
})
export class AdminRidePricingModule {}