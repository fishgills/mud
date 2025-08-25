import { Injectable } from '@nestjs/common';
import {
  ChunkData,
  WorldSeedConfig,
  DEFAULT_WORLD_CONFIG,
  TileData,
} from './types';
import { NoiseGenerator } from '../noise-generator/noise-generator';
import { SettlementGenerator } from '../settlement-generator/settlement-generator';
import { BiomeGenerator } from '../biome-generator/biome-generator';
import { WorldUtilsService } from './world-utils.service';
import { Settlement } from '@mud/database';
import { WorldTile } from './models';
@Injectable()
export class ChunkGeneratorService {
  constructor(private worldUtils: WorldUtilsService) {}

  private computeId(x: number, y: number): number {
    // Deterministic 31-bit positive int based on coordinates
    const xi = (x & 0xffff) >>> 0;
    const yi = (y & 0xffff) >>> 0;
    const mixed = ((xi << 16) ^ yi) >>> 0;
    return mixed & 0x7fffffff;
  }

  generateChunk(chunkX: number, chunkY: number, seed: number): ChunkData {
    const config: WorldSeedConfig = {
      heightSeed: seed,
      temperatureSeed: seed + 1000,
      moistureSeed: seed + 2000,
      ...DEFAULT_WORLD_CONFIG,
    };

    const noiseGenerator = new NoiseGenerator(config);
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

        const tileData = this.generateTile(worldX, worldY, noiseGenerator);

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
          tileData.biome,
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
      tiles: tiles as WorldTile[],
      settlements,
      stats: finalStats,
    };
  }

  /** Compute a single tile deterministically from the given seed. */
  generateTileAt(x: number, y: number, seed: number) {
    const config: WorldSeedConfig = {
      heightSeed: seed,
      temperatureSeed: seed + 1000,
      moistureSeed: seed + 2000,
      ...DEFAULT_WORLD_CONFIG,
    };
    const noiseGenerator = new NoiseGenerator(config);
    const tileData = this.generateTile(x, y, noiseGenerator);
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

  private updateStats(stats: any, tile: TileData): void {
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
    settlements: Settlement[],
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
