import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TsRestHandlerInterceptor } from '@ts-rest/nest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule } from './render/render.module';
import { WorldModule } from './world/world.module';

@Module({
  imports: [RenderModule, WorldModule],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TsRestHandlerInterceptor,
    },
  ],
})
export class AppModule {}
