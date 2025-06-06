import { Module } from '@nestjs/common';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { WorldModule } from '../world/world.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  controllers: [RenderController],
  imports: [WorldModule, PrismaModule],
  providers: [RenderService],
})
export class RenderModule {}
