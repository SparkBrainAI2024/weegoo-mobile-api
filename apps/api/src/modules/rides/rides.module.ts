import {
  RidePersistentModule,
  RidesService,
  RidesResolver,
} from "@libs/services/rides";
import { Module } from "@nestjs/common";
import { UserPersistenceModule } from "@libs/services/user/user-persistent.module";
import { EnvService } from "@libs/common/config/env.service";
import { TransactionModule } from "@libs/services/payment/src/transaction/transaction.module";
import { WalletModule } from "@libs/services/payment/src/wallet/wallet.module";
import { IssuePersistenceModule } from "@libs/services/issue/src/issue-persistence.module";
import { MatchmakingIntegrationService } from "./matchmaking-integration.service";
import { MatchmakingResolver } from "./resolver/matchmaking.resolver";
import { PassengerRidesResolver } from "./resolver/rides.resolver";
import { PassengerHomeResolver } from "./resolver/passenger-home.resolver";
import { PassengerPromoCodeResolver } from "./resolver/passenger-promocode.resolver";
import { PassengerHomeService } from "./passenger-home.service";
import { NearbyDriversService } from "./nearby-drivers.service";
import { NearbyDriversResolver } from "./resolver/nearby-drivers.resolver";
import { UserTransactionResolver } from "@libs/services/payment/src/transaction/resolver/transaction.resolver";
import { S3Module } from "@libs/s3/s3.module";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Rides,
  RidesSchema,
  Vehicle,
  VehicleSchema,
  UserDetails,
  UserDetailsSchema,
  PromoCode,
  PromoCodeSchema,
} from "@libs/data-access";
import {
  UserTokenMeta,
  UserTokenMetaSchema,
} from "@libs/data-access/entities/user-token-meta.entity";
import { PromoCodeService } from "@libs/services/promocode/src/promocode.service";
import { PromoCodePersistenceModule } from "@libs/services/promocode/src/promocode.persistence.module";
import { NotificationModule } from "@libs/services/notification";
import { NotificationModule } from "@libs/services/notification";
@Module({
  imports: [
    RidePersistentModule,
    UserPersistenceModule,
    TransactionModule,
    IssuePersistenceModule,
    S3Module,
    PromoCodePersistenceModule,
    NotificationModule,
    MongooseModule.forFeature([
      { name: Rides.name, schema: RidesSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: UserTokenMeta.name, schema: UserTokenMetaSchema },
    ]),
  ],
  providers: [
    RidesService,
    RidesResolver,
    EnvService,
    MatchmakingIntegrationService,
    MatchmakingResolver,
    PassengerRidesResolver,
    PassengerHomeService,
    PassengerHomeResolver,
    PassengerPromoCodeResolver,
    PromoCodeService,
    NearbyDriversService,
    NearbyDriversResolver,
    UserTransactionResolver,
  ],
  exports: [RidesService],
})
export class RidesModule {}
