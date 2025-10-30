import '@mud/tracer/register';
import './env';

import { Logger } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app/app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

    const logger = new Logger('HTTP');
    logger.log(`[DM-HTTP] ${req.method} ${req.url}`);
    logger.log(`[DM-HTTP] Headers: ${JSON.stringify(req.headers)}`);
    logger.log(`[DM-HTTP] User-Agent: ${userAgent || 'N/A'}`);
    logger.log(
      `[DM-HTTP] Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`,
    );
    logger.log(
      `[DM-HTTP] Content-Type: ${req.headers['content-type'] || 'N/A'}`,
    );
    next();
  });

  // Use PORT from environment when provided by the hosting platform, default to 3000 locally
  const port = env.PORT;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Application is running on: http://0.0.0.0:${port}/`);
}
bootstrap().catch((error) => {
  Logger.error('Failed to bootstrap Dungeon Master service', error);
  process.exit(1);
});
