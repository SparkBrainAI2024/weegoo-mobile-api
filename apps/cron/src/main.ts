import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Bootstrap for the headless `cron` application.
 *
 * This app does not serve GraphQL or a rich REST API — it is a background-job
 * scheduler. We still listen on HTTP so that platform liveness probes work and
 * so `@nestjs/schedule` keeps the event loop alive.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 3005;

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()),
    methods: ['GET', 'OPTIONS'],
    credentials: true,
  });

  await app.listen(port, '0.0.0.0', () => {
    Logger.log(`🚀 Cron app running on port ${port}`, 'Bootstrap');
  });
}

bootstrap().catch((err) => {
  Logger.error(`Failed to bootstrap cron app`, err, 'Bootstrap');
  process.exit(1);
});
