import '@mud/tracer/register';
import './env';
import { Logger } from '@nestjs/common';
import { setAuthLogger } from '@mud/gcp-auth';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { join } from 'path';

async function bootstrap() {
  setAuthLogger(new Logger('GCP-AUTH'));
  const app = await NestFactory.create(AppModule);

  // Connect the gRPC microservice
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.GRPC,
    options: {
      package: 'world',
      protoPath: join(process.cwd(), 'libs/proto/world.proto'),
      url: '0.0.0.0:50051', // Use a separate port for gRPC
    },
  });

  await app.startAllMicroservices();

  const globalPrefix = 'world';
  app.setGlobalPrefix(globalPrefix);
  // Use PORT from environment for HTTP, fallback to 3001
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  Logger.log(`🚀 World GraphQL Service is running on: http://0.0.0.0:${port}/${globalPrefix}`);
  Logger.log(`🚀 World gRPC Service is running on: 0.0.0.0:50051`);
}

bootstrap().catch((err) => {
  Logger.error('Failed to bootstrap world service', err);
  process.exit(1);
});