import '@mud/tracer/register';
import './env';

import { createLogger } from '@mud/logging';
import { NestLogger } from '@mud/logging/nest';

import { NestFactory } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app/app.module';
import { env } from './env';

const bootstrapLogger = createLogger('dm:bootstrap');
const httpLogger = createLogger('dm:http');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new NestLogger('dm:nest'),
  });

  // Add global request logging
  app.use((req: Request, res: Response, next: NextFunction) => {
    // Skip logging for health check probes (including kube-probe user-agent)
    const url = req.originalUrl ?? req.url ?? '';
    const userAgent = (req.headers['user-agent'] || '') as string;
    const isHealthProbe =
      /(^|\/)health(-check)?($|\/)/i.test(url) || /kube-probe/i.test(userAgent);

    if (isHealthProbe) {
      // Do not log noisy health probes
      return next();
    }

    const started = Date.now();
    res.on('finish', () => {
      httpLogger.info(
        {
          method: req.method,
          url,
          status: res.statusCode,
          durationMs: Date.now() - started,
          userAgent: userAgent || undefined,
          hasAuthHeader: Boolean(req.headers.authorization),
          contentType: req.headers['content-type'] || undefined,
        },
        'HTTP request completed',
      );
    });
    next();
  });

  // Use PORT from environment when provided by the hosting platform, default to 3000 locally
  const port = env.PORT;
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.info(
    { port, host: '0.0.0.0' },
    'Application started',
  );
}
bootstrap().catch((error) => {
  bootstrapLogger.error(
    {
      error,
    },
    'Failed to bootstrap Dungeon Master service',
  );
  process.exit(1);
});
