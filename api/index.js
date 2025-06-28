// api/index.js
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { ExpressAdapter } = require('@nestjs/platform-express');
const express = require('express');

let server;

async function bootstrap() {
  const app = express();
  const nestApp = await NestFactory.create(AppModule, new ExpressAdapter(app));
  nestApp.setGlobalPrefix('api');
  nestApp.enableCors();
  await nestApp.init();
  return app;
}

module.exports = async (req, res) => {
  if (!server) {
    server = await bootstrap();
  }

  server(req, res);
};
