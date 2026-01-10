import { Module } from '@nestjs/common';
import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldModule } from '../world/world.module';
import { CacheService } from '../shared/cache.service';
import { SpriteService } from './sprites/sprite.service';

@Module({
  controllers: [RenderController],
  imports: [WorldModule, PrismaModule],
  providers: [RenderService, CacheService, SpriteService],
})
export class RenderModule {}
