import { Injectable, Logger } from '@nestjs/common';
import { ChunkData, WorldSeedConfig, DEFAULT_WORLD_CONFIG } from './types';
import { NoiseGenerator } from '../noise-generator/noise-generator';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { BiomeGenerator } from '../biome-generator/biome-generator';
import { WorldUtilsService } from './world-utils.service';
import { WorldTile } from '@prisma/client';

@Injectable()
export class ChunkGeneratorService {
  private readonly logger = new Logger(ChunkGeneratorService.name);

  constructor(private worldUtils: WorldUtilsService) {}

  generateChunk(chunkX: number, chunkY: number, seed: number): ChunkData {
    const config: WorldSeedConfig = {
      heightSeed: seed,
      temperatureSeed: seed + 1000,
      moistureSeed: seed + 2000,
      ...DEFAULT_WORLD_CONFIG,
    };

    const noiseGenerator = new NoiseGenerator(config);
    const settlementGenerator = new SettlementGenerator(seed);

    const tiles: TileData[] = [];
    const settlements: ChunkData['settlements'] = [];
    const stats = this.initializeStats();

    const startX = chunkX * WorldUtilsService.CHUNK_SIZE;
    const startY = chunkY * WorldUtilsService.CHUNK_SIZE;

    // Generate tiles
    for (let localX = 0; localX < WorldUtilsService.CHUNK_SIZE; localX++) {
      for (let localY = 0; localY < WorldUtilsService.CHUNK_SIZE; localY++) {
        const worldX = startX + localX;
        const worldY = startY + localY;

        const tile = this.generateTile(worldX, worldY, noiseGenerator);
        tiles.push(tile);

        this.updateStats(stats, tile);

        // Check for settlement generation
        this.tryGenerateSettlement(
          worldX,
          worldY,
          tile.biome,
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
      tiles,
      settlements,
      stats: finalStats,
    };
  }

  private generateTile(
    x: number,
    y: number,
    noiseGenerator: NoiseGenerator,
  ): TileData {
    const height = noiseGenerator.generateHeight(x, y);
    const temperature = noiseGenerator.generateTemperature(x, y);
    const moisture = noiseGenerator.generateMoisture(x, y);
    const biome = BiomeGenerator.determineBiome(height, temperature, moisture);

    return {
      x,
      y,
      height,
      temperature,
      moisture,
      biome,
    };
  }

  private initializeStats() {
    return {
      biomes: {} as Record<string, number>,
      totalHeight: 0,
      totalTemperature: 0,
      totalMoisture: 0,
    };
  }

  private updateStats(stats: any, tile: WorldTile): void {
    stats.biomes[tile.biome.name] = (stats.biomes[tile.biome.name] || 0) + 1;
    stats.totalHeight += tile.height;
    stats.totalTemperature += tile.temperature;
    stats.totalMoisture += tile.moisture;
  }

  private finalizeStats(stats: any, totalTiles: number) {
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
    biome: any,
    settlementGenerator: SettlementGenerator,
    settlements: ChunkData['settlements'],
  ): void {
    if (!settlementGenerator.shouldGenerateSettlement(x, y, biome)) {
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
      const settlement = settlementGenerator.generateSettlement(x, y, biome);
      settlements.push(settlement);
    }
  }
}
