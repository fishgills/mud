import { Module } from '@nestjs/common';
import { createWinstonModuleForRoot } from '@mud/logging/nest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RenderModule } from './render/render.module';
import { WorldModule } from './world/world.module';

@Module({
  imports: [
    RenderModule,
    WorldModule,
    ...createWinstonModuleForRoot({ serviceName: 'world' }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
