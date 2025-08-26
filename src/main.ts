// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  // 1) create the app
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 2) CORS (driven by ENV, defaulting to no‐origins)
  const config = app.get(ConfigService);
  const corsList = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean);
  app.enableCors({
    origin: (incoming, cb) =>
      cb(null, !incoming || corsList.includes(incoming)),
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 3) Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 4) Swagger
  const docConfig = new DocumentBuilder()
    .setTitle('Rojas Solutions API')
    .setDescription('API documentation for Rojas Solutions backend system')
    .setVersion('1.0')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, docConfig);
  SwaggerModule.setup('api', app, swaggerDoc);

  app.set('trust proxy', 1);

  // 5) port resolution
  const rawPort = process.env.PORT ?? '5001';
  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port)) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  // 6) actually listen
  await app.listen(port);
  console.log(`🚀 Server listening on port ${port}`);
}

// catch any error during bootstrap, log and exit
bootstrap().catch((err) => {
  console.error('💥 Bootstrap error:', err);
  process.exit(1);
});
