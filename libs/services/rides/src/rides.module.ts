import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromoCode, PromoCodeSchema } from '@libs/data-access';
import { PromoCodeUsed, PromoCodeUsedSchema } from '@libs/data-access/entities/promo-code-used.entity';
import { RidesResolver } from './resolver/rides.resolver';
import { RidesService } from './rides.service';
import { RidePersistentModule } from './rides-persistent.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';
import { Issue } from '@libs/data-access/entities/issue.entity';
import { IssuePersistenceModule } from '@libs/services/issue/src/issue-persistence.module';

@Module({
  imports: [
    RidePersistentModule,
    IssuePersistenceModule
  ],
  providers: [RidesResolver,RidesService,TransactionService],
})
export class UserRidesModule {}