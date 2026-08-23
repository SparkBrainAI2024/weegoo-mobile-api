import { Module } from "@nestjs/common";
import { AvailabilityPersistentModule } from "./availability-persistent.module";
import { AvailabilityService } from "./availability.service";
import { AvailabilityResolver } from "./availability.resolver";

@Module({
  imports: [AvailabilityPersistentModule],
  providers: [AvailabilityService, AvailabilityResolver],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}