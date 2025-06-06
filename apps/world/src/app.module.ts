import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WorldModule } from './world/world.module';
import { RouterModule } from '@nestjs/core';
import { RenderModule } from './render/render.module';

@Module({
  imports: [
    WorldModule,
    RouterModule.register([
      {
        path: 'world',
        module: WorldModule,
      },
    ]),
    RenderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
