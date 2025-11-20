import '@mud/tracer/register';
import './env';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { env } from './env';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';
import { PlainConsoleLogger } from '@mud/logging';

const HEALTH_PATH_REGEX = /(^|\/)health(-check)?($|\/)/i;

const isHealthCheckPath = (url: string | undefined): boolean =>
  typeof url === 'string' && HEALTH_PATH_REGEX.test(url);

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

  app.setGlobalPrefix('dm');

  // Simple access log for every HTTP request
  const httpLogger = runningInGke
    ? new PlainConsoleLogger('HTTP')
    : new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    const method = req.method;
    const url = req.originalUrl ?? req.url ?? '';
    const userAgent = req.headers['user-agent'];

    res.on('finish', () => {
      if (runningInGke && isHealthCheckPath(url) && res.statusCode < 400) {
        return;
      }
      const duration = Date.now() - started;
      const contentLength = res.getHeader('content-length');
      httpLogger.log(
        `${method} ${url} ${res.statusCode} ${duration}ms UA:${userAgent ?? 'unknown'}${
          contentLength ? ` len:${contentLength}` : ''
        }`,
      );
    });

    next();
  });

  await app.listen(env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
