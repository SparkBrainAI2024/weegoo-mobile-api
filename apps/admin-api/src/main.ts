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
import { HttpExceptionFilter } from "@libs/common";

async function bootstrap() {
  const server = express();
  const appOptions = { cors: true };

  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
    new ExpressAdapter(server),
    appOptions,
  );

  app.enableCors({
 origin: process.env.ALLOWED_ORIGINS
    ?.split(',')
    .map(origin => origin.trim()),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "lang"
    ],
    credentials: true,
  });

  app.setGlobalPrefix("admin-api");
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

  // Serve email template assets (car-icon.svg, etc.)
  // Try multiple paths to support dev (ts-node) and prod (webpack) builds
  const fs = require("fs");
  const possibleTemplatePaths = [
    // Dev: project root → libs/services/mail/templates
    join(process.cwd(), "libs", "services", "mail", "templates"),
    // Dev: project root → libs/services/email-template/src/templates
    join(process.cwd(), "libs", "services", "email-template", "src", "templates"),
    // Prod: dist/apps/admin-api/templates
    join(__dirname, "templates"),
    // Prod: dist/libs/services/mail/templates
    join(process.cwd(), "dist", "libs", "services", "mail", "templates"),
  ];

  const emailTemplatesPath = possibleTemplatePaths.find((p) => fs.existsSync(p));
  if (emailTemplatesPath) {
    app.useStaticAssets(emailTemplatesPath, {
      prefix: "/assets/",
    });
    console.log(`Serving email assets from: ${emailTemplatesPath}`);
  } else {
    console.warn(`Email template assets not found. Tried: ${possibleTemplatePaths.join(", ")}`);
  }


  return app;
}

// For traditional server deployment (Railway, Heroku, etc.)
bootstrap().then((app) => {
  const port = process.env.PORT || 3002;
  app.listen(port, "0.0.0.0", () => {
    console.log(`🚀 Admin API running on port ${port}`);
  });
}).catch((err) => {
  console.error('Failed to bootstrap app:', err);
  process.exit(1);
});

// For serverless deployment (keep for backward compatibility)
export default async function handler(req, res) {
  const app = await bootstrap();
  const expressApp = app.getHttpAdapter().getInstance();
  return expressApp(req, res);
}