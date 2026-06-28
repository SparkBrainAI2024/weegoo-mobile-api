import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rides, RidesSchema } from '@libs/data-access/entities/rides.entity';
import { User, UserSchema } from '@libs/data-access/entities/user.entity';
import { UserDetails, UserDetailsSchema } from '@libs/data-access/entities/user-details.entity';
import { Vehicle, VehicleSchema } from '@libs/data-access/entities/vehicle.entity';
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

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rides.name, schema: RidesSchema },
      { name: User.name, schema: UserSchema },
      { name: UserDetails.name, schema: UserDetailsSchema },
      { name: Vehicle.name, schema: VehicleSchema },
    ]),
    NotificationPersistentModule,
    AblyModule,
    TransactionModule,
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
