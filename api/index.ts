// api/index.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Express } from 'express';
import { AppModule } from '../dist/app.module';

let server: Express;

async function bootstrap(): Promise<Express> {
  const app = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(app));
  nestApp.setGlobalPrefix('api');
  nestApp.enableCors(); // or pass your CORS options here
  await nestApp.init();
  return app;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (!server) {
    server = await bootstrap();
  }

  server(req as express.Request, res as unknown as express.Response);
}
