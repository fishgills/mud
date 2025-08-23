import { Module } from '@nestjs/common';
// import { RenderController } from './render.controller';
import { RenderService } from './render.service';
import { RenderResolver } from './render.resolver';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldModule } from '../world/world.module';
import { CacheService } from '../shared/cache.service';

@Module({
  // controllers: [RenderController],
  imports: [WorldModule, PrismaModule],
  providers: [RenderService, RenderResolver, CacheService],
})
export class RenderModule {}
