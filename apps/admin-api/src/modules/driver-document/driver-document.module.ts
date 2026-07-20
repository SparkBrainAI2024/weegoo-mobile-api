import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

import { PassengerService } from "@libs/services/passenger/passenger.service";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { EnvService } from "@libs/common/config/env.service";
import { S3Module } from "@libs/s3";
import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";
import { DriverDocumentResolver } from "./resolver/driver-document.resolver";
import { CommonDriverDocumentModule } from "@libs/services/driver-document/driver-document.module";
import { AdminAuthModule } from "../auth/auth.module";

@Module({
  imports: [
    UserAuthModule,
    UserPersistenceModule,
    S3Module,
    RidePersistentModule,
    CommonDriverDocumentModule,
    AdminAuthModule,
  ],
  providers: [DriverDocumentResolver, EnvService],
  exports: [DriverDocumentResolver],
})
export class DriverDocumentModule {}
