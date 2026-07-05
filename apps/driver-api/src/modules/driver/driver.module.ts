import { Module } from "@nestjs/common";
import { DriverResolver } from "./resolver/driver.resolver";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { CommonDriverDocumentModule } from "@libs/services/driver-document/driver-document.module";
import { TransactionPersistenceModule } from "@libs/services/payment/src/transaction/transaction-persistence.module";
import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";
import { DriverService } from "@libs/services/driver/driver.service";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { EnvService } from "@libs/common/config/env.service";

@Module({
  imports: [
    UserAuthModule,
    UserPersistenceModule,
    CommonDriverDocumentModule,
    TransactionPersistenceModule,
    RidePersistentModule,
    CommonVehicleModule,
  ],
  providers: [DriverResolver, DriverService, EnvService],
  exports: [DriverResolver],
})
export class DriverModule {}
