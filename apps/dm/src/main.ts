import '@mud/tracer/register';
import './env';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { env } from './env';
import type { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Simple access log for every HTTP request
  const httpLogger = new Logger('HTTP');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    const method = req.method;
    const url = req.originalUrl ?? req.url ?? '';
    const userAgent = req.headers['user-agent'];

    res.on('finish', () => {
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
