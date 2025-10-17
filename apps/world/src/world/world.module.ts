import { Module } from '@nestjs/common';
import { WorldService } from './world-refactored.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { WorldDatabaseService } from './world-database.service';
import { TileService } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import { PrismaModule } from '../prisma/prisma.module';
import { WorldController } from './world.controller';

@Module({
  imports: [PrismaModule],
  controllers: [WorldController],
  providers: [
    WorldService,
    ChunkGeneratorService,
    WorldDatabaseService,
    TileService,
    WorldUtilsService,
  ],
  exports: [WorldService],
})
export class WorldModule {}
