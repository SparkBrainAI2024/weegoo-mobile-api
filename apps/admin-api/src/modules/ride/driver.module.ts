import { Module } from "@nestjs/common";
import { AdminRidesResolver } from "./resolver/ride.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";

import { UserAuthModule } from "@libs/services/auth/auth.module";
import { EnvService } from "@libs/common/config/env.service";
import { RidesService } from "@libs/services/rides/rides.service";

@Module({
  imports: [
    UserAuthModule,
    UserPersistenceModule,
    RidePersistentModule,
    CommonVehicleModule,
  ],
  providers: [AdminRidesResolver, RidesService, EnvService],
  exports: [AdminRidesResolver],
})
export class AdminRidesModule {}
