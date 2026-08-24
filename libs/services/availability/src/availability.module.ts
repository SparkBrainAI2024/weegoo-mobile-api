import { Module } from "@nestjs/common";
import { EnvService } from "@libs/common/config/env.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { AvailabilityPersistentModule } from "./availability-persistent.module";
import { AvailabilityService } from "./availability.service";
import { AvailabilityResolver } from "./availability.resolver";

@Module({
  imports: [AvailabilityPersistentModule, UserPersistenceModule],
  providers: [AvailabilityService, AvailabilityResolver, EnvService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}