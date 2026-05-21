import { Module } from '@nestjs/common';
import { RidesResolver } from './resolver/rides.resolver';
import { RidesService } from './rides.service';
import { RidePersistentModule } from './rides-persistent.module';
import { TransactionModule } from '@libs/services/payment/src/transaction/transaction.module';

@Module({
  imports: [RidePersistentModule, TransactionModule],
  providers: [RidesResolver,RidesService],
})
export class UserRidesModule {}