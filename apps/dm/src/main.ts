import './tracer';
import './env';

import { Logger } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Use PORT from environment when provided by Cloud Run, default to 3000 locally
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Application is running on: http://0.0.0.0:${port}/`);
}

bootstrap();
