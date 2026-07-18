import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";

import { PassengerService } from "@libs/services/passenger/passenger.service";
import { UserAuthModule } from "@libs/services/auth/auth.module";
import { EnvService } from "@libs/common/config/env.service";
import { PassengerResolver } from "./resolver/passenger.resolver";
import { S3Module } from "@libs/s3";
import { RidePersistentModule } from "@libs/services/rides/rides-persistent.module";

@Module({
  imports: [
    UserAuthModule,
    UserPersistenceModule,
    S3Module,
    RidePersistentModule,
  ],
  providers: [PassengerResolver, PassengerService, EnvService],
  exports: [PassengerResolver],
})
export class PassengerModule {}
