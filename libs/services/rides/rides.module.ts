import { Module } from '@nestjs/common';
import { RidesResolver } from './resolver/rides.resolver';
import { RidesService } from './rides.service';
import { RidePersistentModule } from './rides-persistent.module';

@Module({
  imports: [RidePersistentModule],
  providers: [RidesResolver,RidesService],
})
export class RidesModule {}