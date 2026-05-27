import { Module } from '@nestjs/common';
import { RidesResolver } from './resolver/rides.resolver';
import { RidesService } from './rides.service';
import { RidePersistentModule } from './rides-persistent.module';
import { TransactionService } from '@libs/services/payment/src/transaction/transaction.service';

@Module({
  imports: [RidePersistentModule],
  providers: [RidesResolver,RidesService,TransactionService],
})
export class UserRidesModule {}