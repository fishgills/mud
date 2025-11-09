import '@mud/tracer/register';
import './env';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { env } from './env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('world');
  await app.listen(env.PORT, '0.0.0.0');
}

bootstrap();
