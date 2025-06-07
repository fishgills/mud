import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RouterModule } from '@nestjs/core';
import { RenderModule } from './render/render.module';
import { WorldRefactoredModule } from './world/world-refactored.module';

@Module({
  imports: [
    WorldRefactoredModule,
    RouterModule.register([
      {
        path: 'world',
        module: WorldRefactoredModule,
      },
    ]),
    RenderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
