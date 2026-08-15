import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { envConfiguration } from '@libs/common';
import { CronModule } from './modules/cron/cron.module';

/**
 * AppModule for the dedicated `cron` application.
 *
 * This app hosts ALL scheduled (@Cron) jobs for the platform, keeping them
 * isolated from the request-serving API apps. It wires up:
 *  - global config (env vars)
 *  - the shared MongoDB connection
 *  - the NestJS schedule module (required for @Cron decorators)
 *  - the CronModule that contains every cron job
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: 'apps/cron/.env',
      load: [envConfiguration],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('DB_CONNECTION_URL'),
      }),
    }),
    ScheduleModule.forRoot(),
    CronModule,
  ],
})
export class AppModule {}
