import { Module } from '@nestjs/common';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldModule } from '../world/world.module';
import { CacheService } from '../shared/cache.service';
import { RenderApiController } from './render-api.controller';

@Module({
  controllers: [RenderController, RenderApiController],
  imports: [WorldModule, PrismaModule],
  providers: [RenderService, CacheService],
})
export class RenderModule {}
