import { Module } from '@nestjs/common';
import { WorldService } from './world-refactored.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { WorldDatabaseService } from './world-database.service';
import { TileService } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldController } from './world.controller';
import { HqController } from '../hq/hq.controller';
import { HqService } from '../hq/hq.service';
import { SpawnSelectorService } from '../hq/spawn-selector.service';

@Module({
  imports: [PrismaModule],
  controllers: [WorldController, HqController],
  providers: [
    WorldService,
    ChunkGeneratorService,
    WorldDatabaseService,
    TileService,
    WorldUtilsService,
    HqService,
    SpawnSelectorService,
  ],
  exports: [WorldService],
})
export class WorldModule {}
