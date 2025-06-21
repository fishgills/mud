import { Module } from '@nestjs/common';
import { ChunkResolver } from './chunk.resolver';
import { WorldTileResolver } from './world-tile.resolver';
import { TileResolver } from './tile.resolver';
import { WorldService } from './world-refactored.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { WorldDatabaseService } from './world-database.service';
import { TileService } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    ChunkResolver,
    WorldTileResolver,
    TileResolver,
    WorldService,
    ChunkGeneratorService,
    WorldDatabaseService,
    TileService,
    WorldUtilsService,
  ],
  exports: [WorldService],
})
export class WorldModule {}
