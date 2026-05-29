import { NestFactory } from '@nestjs/core';
import { RideMatchmakingModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(RideMatchmakingModule);
  const port = Number(process.env.RIDE_MATCHMAKING_PORT) || 4000;

  app.enableCors({
    origin: ['https://ridehailing.com', 'https://www.ridehailing.com', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  });

  await app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Ride Matchmaking service running on port ${port}`);
  });
}
bootstrap();