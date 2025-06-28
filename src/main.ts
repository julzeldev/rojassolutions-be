import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  const port = process.env.PORT || configService.get<number>('PORT') || 5001;

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Rojas Solutions API')
    .setDescription('API documentation for Rojas Solutions backend system')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Enable CORS for specific origin (local network dev)
  app.enableCors({
    origin: ['http://localhost:5173', 'http://192.168.100.5:5173'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Trust proxy headers (important for Heroku)
  app.set('trust proxy', 1);

  await app.listen(port);
}
void bootstrap();
