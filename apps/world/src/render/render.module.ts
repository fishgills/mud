import { Module } from '@nestjs/common';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldRefactoredModule } from '../world/world-refactored.module';

@Module({
  controllers: [RenderController],
  imports: [WorldRefactoredModule, PrismaModule],
  providers: [RenderService],
})
export class RenderModule {}
