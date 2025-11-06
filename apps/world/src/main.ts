import '@mud/tracer/register';
import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './env';
import { NestWinstonLogger, createLogger } from '@mud/logging';

const bootstrapLogger = createLogger('world:bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new NestWinstonLogger('world:nest'),
  });
  const globalPrefix = 'world';
  app.setGlobalPrefix(globalPrefix);
  // Use PORT from environment, fallback to 3001
  const port = env.PORT;
  let databaseHost: string | undefined;
  try {
    const parsed = new URL(env.DATABASE_URL);
    databaseHost = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    databaseHost = undefined;
  }
  bootstrapLogger.debug('Database connection configured', {
    host: databaseHost,
  });
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.info('World service started', {
    port,
    host: '0.0.0.0',
    prefix: globalPrefix,
  });
}

bootstrap().catch((error) => {
  bootstrapLogger.error('Failed to bootstrap world service', { error });
  process.exit(1);
});
