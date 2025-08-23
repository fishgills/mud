import './tracer';
import './env';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'world';
  app.setGlobalPrefix(globalPrefix);
  const port = 3001;
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `🚀 World Service is running on: http://0.0.0.0:${port}/${globalPrefix}`,
  );
}

bootstrap();
