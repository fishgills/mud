import { Injectable } from '@nestjs/common';
import { ChunkData, TileData } from './types';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { WorldUtilsService } from './world-utils.service';
import { Settlement } from '@mud/database';
import type { WorldTile } from './dto';
import { GridMapGenerator } from '../gridmap/gridmap-generator';
import { DEFAULT_BIOMES } from '../gridmap/default-biomes';
import { mapGridBiomeToBiomeInfo } from '../gridmap/biome-mapper';
import { buildGridConfigs, deriveTemperature } from '../gridmap/utils';
@Injectable()
export class ChunkGeneratorService {
  constructor(private worldUtils: WorldUtilsService) {}

  private initializeStats(): GenerationStats {
    return {
      biomes: {},
      totalHeight: 0,
      totalTemperature: 0,
      totalMoisture: 0,
    };
  }

  private computeId(x: number, y: number): number {
    // Deterministic 31-bit positive int based on coordinates
    const xi = (x & 0xffff) >>> 0;
    const yi = (y & 0xffff) >>> 0;
    const mixed = ((xi << 16) ^ yi) >>> 0;
    return mixed & 0x7fffffff;
  }

  generateChunk(chunkX: number, chunkY: number, seed: number): ChunkData {
    const { heightConfig, moistureConfig } = buildGridConfigs();
    const gridGenerator = new GridMapGenerator(
      heightConfig,
      moistureConfig,
      DEFAULT_BIOMES,
      seed,
    );
    const settlementGenerator = new SettlementGenerator(seed);

    const tiles: Partial<WorldTile>[] = [];
    const settlements: ChunkData['settlements'] = [];
    const stats = this.initializeStats();

    const startX = chunkX * WorldUtilsService.CHUNK_SIZE;
    const startY = chunkY * WorldUtilsService.CHUNK_SIZE;

    // Generate tiles
    for (let localX = 0; localX < WorldUtilsService.CHUNK_SIZE; localX++) {
      for (let localY = 0; localY < WorldUtilsService.CHUNK_SIZE; localY++) {
        const worldX = startX + localX;
        const worldY = startY + localY;

        const tileData = this.generateTile(worldX, worldY, gridGenerator);

        // Convert TileData to WorldTile format
        const worldTile: Partial<WorldTile> = {
          id: this.computeId(tileData.x, tileData.y),
          x: tileData.x,
          y: tileData.y,
          biomeId: tileData.biome.id,
          biomeName: tileData.biome.name,
          height: tileData.height,
          temperature: tileData.temperature,
          moisture: tileData.moisture,
          seed: seed,
          chunkX: Math.floor(tileData.x / 50),
          chunkY: Math.floor(tileData.y / 50),
          description: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };

        tiles.push(worldTile);

        this.updateStats(stats, tileData);

        // Check for settlement generation
        this.tryGenerateSettlement(
          worldX,
          worldY,
          tileData,
          settlementGenerator,
          settlements,
        );
      }
    }

    const finalStats = this.finalizeStats(
      stats,
      WorldUtilsService.CHUNK_SIZE * WorldUtilsService.CHUNK_SIZE,
    );

    return {
      chunkX,
      chunkY,
      tiles: tiles as WorldTile[],
      settlements,
      stats: finalStats,
    };
  }

  /** Compute a single tile deterministically from the given seed. */
  generateTileAt(x: number, y: number, seed: number) {
    const { heightConfig, moistureConfig } = buildGridConfigs();
    const gridGenerator = new GridMapGenerator(
      heightConfig,
      moistureConfig,
      DEFAULT_BIOMES,
      seed,
    );
    const tileData = this.generateTile(x, y, gridGenerator);
    const worldTile: Partial<WorldTile> = {
      id: this.computeId(tileData.x, tileData.y),
      x: tileData.x,
      y: tileData.y,
      biomeId: tileData.biome.id,
      biomeName: tileData.biome.name,
      height: tileData.height,
      temperature: tileData.temperature,
      moisture: tileData.moisture,
      seed,
      chunkX: Math.floor(tileData.x / 50),
      chunkY: Math.floor(tileData.y / 50),
      description: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
    return worldTile as WorldTile;
  }

  private generateTile(
    x: number,
    y: number,
    gridGenerator: GridMapGenerator,
  ): TileData {
    const sample = gridGenerator.sampleTile(x, y);
    const biomeInfo = mapGridBiomeToBiomeInfo(sample.biome);
    const temperature = deriveTemperature(
      sample.rawHeight,
      sample.rawMoisture,
      y,
    );

    return {
      x,
      y,
      height: sample.height,
      temperature,
      moisture: sample.moisture,
      biome: biomeInfo,
    };
  }

  private updateStats(stats: GenerationStats, tile: TileData): void {
    stats.biomes[tile.biome.name] = (stats.biomes[tile.biome.name] || 0) + 1;
    stats.totalHeight += tile.height;
    stats.totalTemperature += tile.temperature;
    stats.totalMoisture += tile.moisture;
  }

  private finalizeStats(
    stats: GenerationStats,
    totalTiles: number,
  ): ChunkData['stats'] {
    return {
      biomes: stats.biomes,
      averageHeight: stats.totalHeight / totalTiles,
      averageTemperature: stats.totalTemperature / totalTiles,
      averageMoisture: stats.totalMoisture / totalTiles,
    };
  }

  private tryGenerateSettlement(
    x: number,
    y: number,
    tile: TileData,
    settlementGenerator: SettlementGenerator,
    settlements: Settlement[],
  ): void {
    if (!settlementGenerator.shouldGenerateSettlement(x, y, tile)) {
      return;
    }

    // Check for overlap with existing settlements
    const hasOverlap = this.worldUtils.checkSettlementOverlap(
      x,
      y,
      'medium', // Default size for checking, actual size determined by generator
      settlements,
    );

    if (!hasOverlap) {
      const settlement = settlementGenerator.generateSettlement(
        x,
        y,
        tile.biome,
      );
      settlements.push(settlement);
    }
  }
}

type GenerationStats = {
  biomes: Record<string, number>;
  totalHeight: number;
  totalTemperature: number;
  totalMoisture: number;
};
