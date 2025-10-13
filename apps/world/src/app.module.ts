import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule } from './render/render.module';
import { WorldModule } from './world/world.module';

@Module({
  imports: [RenderModule, WorldModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
