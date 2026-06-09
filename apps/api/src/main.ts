import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {
  NestExpressApplication,
  ExpressAdapter,
} from "@nestjs/platform-express";
import { join } from "path";
import compression from "compression";
import helmet from "helmet";
import express from "express";
import { HttpExceptionFilter, TrimPipe } from "@libs/common";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const server = express();
  const appOptions = { cors: true };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
    appOptions,
  );

  // ✅ ADD THIS
  app.useGlobalPipes(
    new TrimPipe(),
    new ValidationPipe({ transform: true, whitelist: true,forbidNonWhitelisted:true }),
  );

  app.enableCors({
    origin:process.env.ALLOWED_ORIGINS
    ?.split(',')
    .map(origin => origin.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
    ],
    credentials: true,
  });

  app.setGlobalPrefix("driver-api");
  app.useGlobalFilters(new HttpExceptionFilter());

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  app.use(compression());

  app.useStaticAssets(join(__dirname, "..", "files"), {
    prefix: "/files/",
  });

  await app.init();

  return app;
}

// For traditional server deployment (Railway, Heroku, etc.)
bootstrap().then((app) => {
  const port = Number(process.env.PORT) || 3000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 API running on port ${port}`);
  });
}).catch((err) => {
  console.log('Error during app bootstrap:', err);
  console.error('Failed to bootstrap app:', err);
  process.exit(1);
});

export default async function handler(req, res) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}