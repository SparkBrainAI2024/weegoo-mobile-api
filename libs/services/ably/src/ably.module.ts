import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvService } from '@libs/common/config/env.service';
import { AblyService } from './ably.service';
import { AblyRideListenerService } from './ably-ride-listener.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ConfigService, EnvService, AblyService, AblyRideListenerService],
  exports: [AblyService, AblyRideListenerService],
})
export class AblyModule {}