import '@mud/tracer/register';
import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './env';
import { Logger } from '@nestjs/common';
import { PlainConsoleLogger } from '@mud/logging';

const runningInGke = Boolean(process.env.KUBERNETES_SERVICE_HOST);

async function bootstrap() {
  const baseLogger = runningInGke ? new PlainConsoleLogger() : undefined;
  if (baseLogger) {
    Logger.overrideLogger(baseLogger);
  }
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    ...(baseLogger ? { logger: baseLogger } : {}),
  });
  if (baseLogger) {
    app.useLogger(baseLogger);
  }
  app.setGlobalPrefix('world');
  await app.listen(env.PORT, '0.0.0.0');
}

bootstrap();
