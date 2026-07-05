import { Module } from "@nestjs/common";
import { DriverResolver } from "./resolver/driver.resolver";
import { DriverService } from "./driver.service";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { CommonDriverDocumentModule } from "@libs/services/driver-document/driver-document.module";
import { TransactionPersistenceModule } from "@libs/services/payment/src/transaction/transaction-persistence.module";
import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
import { CommonVehicleModule } from "@libs/services/vehicle/vehicle.module";

@Module({
  imports: [
    UserPersistenceModule,
    CommonDriverDocumentModule,
    TransactionPersistenceModule,
    RidePersistentModule,
    CommonVehicleModule,
  ],
  providers: [DriverResolver, DriverService],
  exports: [DriverResolver],
})
export class DriverModule {}
