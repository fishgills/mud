import '@mud/tracer/register';
import './env';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('dm');
  await app.listen(env.PORT ?? 3000, '0.0.0.0');
}
bootstrap();
