import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rides, RidesSchema } from '@libs/data-access/entities/rides.entity';
import { User, UserSchema } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsSchema } from '@libs/data-access/entities/user-details.entity';
import { Vehicle, VehicleSchema } from '@libs/data-access/entities/vehicle.entity';
import { UserDailyOnlineStatus, UserDailyOnlineStatusSchema } from '@libs/data-access/entities/user-daily-online-status.entity';
import { PromoCode, PromoCodeSchema } from '@libs/data-access/entities/promo-code.entity';
import { PromoCodeUsed, PromoCodeUsedSchema } from '@libs/data-access/entities/promo-code-used.entity';
import { MatchmakingService } from './matchmaking.service';
import { MatchmakingResolver } from './matchmaking.resolver';
import { DistanceCalculatorService } from './services/distance-calculator.service';
import { DynamicPricingService } from './services/dynamic-pricing.service';
import { NotificationPersistentModule } from '@libs/services/notification';
import { NotificationService } from '@libs/services/notification';
import { FirebaseMessagingService } from '@libs/services/firebase-messaging';
import { EnvService } from '@libs/common/config/env.service';
import { S3Service } from '@libs/s3';
import { AblyModule } from '@libs/services/ably';
import { TransactionModule } from '@libs/services/payment/src/transaction/transaction.module';
import { WalletModule } from '@libs/services/payment/src/wallet/wallet.module';
import { UserPersistenceModule } from '@libs/services/user/user-persistent.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rides.name, schema: RidesSchema },
      { name: User.name, schema: UserSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
      { name: UserDailyOnlineStatus.name, schema: UserDailyOnlineStatusSchema },
      { name: Vehicle.name, schema: VehicleSchema },
      { name: PromoCode.name, schema: PromoCodeSchema },
      { name: PromoCodeUsed.name, schema: PromoCodeUsedSchema },
    ]),
    NotificationPersistentModule,
    UserPersistenceModule,
    AblyModule,
    TransactionModule,
    WalletModule,
  ],
  providers: [
    MatchmakingResolver,
    MatchmakingService,
    DistanceCalculatorService,
    DynamicPricingService,
    FirebaseMessagingService,
    EnvService,
    NotificationService,
    S3Service,
  ],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}