import { Module } from '@nestjs/common';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldModule } from '../world/world.module';

@Module({
  controllers: [RenderController],
  imports: [WorldModule, PrismaModule],
  providers: [RenderService],
})
export class RenderModule {}
