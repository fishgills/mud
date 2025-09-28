import './tracer';
import './env';
import { Logger } from '@nestjs/common';
import { setAuthLogger } from '@mud/gcp-auth';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  setAuthLogger(new Logger('GCP-AUTH'));
  const app = await NestFactory.create(AppModule);
  const globalPrefix = 'world';
  app.setGlobalPrefix(globalPrefix);
  // Use PORT from environment, fallback to 3001
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  Logger.log(
    `🚀 World Service is running on: http://0.0.0.0:${port}/${globalPrefix}`,
  );
}

bootstrap();
