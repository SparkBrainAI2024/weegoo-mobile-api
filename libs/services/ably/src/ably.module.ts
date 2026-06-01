import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EnvService } from '@libs/common/config/env.service';
import { AblyService } from './ably.service';
import { AblyRideListenerService } from './ably-ride-listener.service';
import { RideChannelService } from './ride-channel.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ConfigService, EnvService, AblyService, AblyRideListenerService, RideChannelService],
  exports: [AblyService, AblyRideListenerService, RideChannelService, EnvService, ConfigService],
})
export class AblyModule {}
