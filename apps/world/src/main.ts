import '@mud/tracer/register';
import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './env';
import { createLogger } from '@mud/logging';
import { NestLogger } from '@mud/logging/nest';

const bootstrapLogger = createLogger('world:bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    logger: new NestLogger('world:nest'),
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
  bootstrapLogger.debug(
    {
      host: databaseHost,
    },
    'Database connection configured',
  );
  await app.listen(port, '0.0.0.0');
  bootstrapLogger.info(
    {
      port,
      host: '0.0.0.0',
      prefix: globalPrefix,
    },
    'World service started',
  );
}

bootstrap().catch((error) => {
  bootstrapLogger.error(
    { error },
    'Failed to bootstrap world service',
  );
  process.exit(1);
});
