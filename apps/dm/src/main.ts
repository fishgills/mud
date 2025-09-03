import './tracer';
import './env';

import { Logger } from '@nestjs/common';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Add global request logging
  app.use((req: any, res: any, next: any) => {
    const logger = new Logger('HTTP');
    logger.log(`[DM-HTTP] ${req.method} ${req.url}`);
    logger.log(`[DM-HTTP] Headers: ${JSON.stringify(req.headers)}`);
    logger.log(`[DM-HTTP] User-Agent: ${req.headers['user-agent'] || 'N/A'}`);
    logger.log(
      `[DM-HTTP] Authorization: ${req.headers.authorization ? 'Present' : 'Missing'}`,
    );
    logger.log(
      `[DM-HTTP] Content-Type: ${req.headers['content-type'] || 'N/A'}`,
    );
    next();
  });

  // Use PORT from environment when provided by Cloud Run, default to 3000 locally
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 Application is running on: http://0.0.0.0:${port}/`);
}

bootstrap();
