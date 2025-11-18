import { Injectable } from '@nestjs/common';
import { MonsterService } from './monster.service';
import { WorldService } from '../world/world.service';

export interface BiomeDensityTarget {
  biomeName: string; // lowercase key
  per1000Tiles: number; // desired density normalized
}

export interface BiomeSpawnReport {
  biome: string;
  tiles: number;
  targetPer1000: number;
  targetCount: number;
  current: number;
  deficit: number;
  spawned: number;
}

@Injectable()
export class PopulationService {
  // Default targets; tune per world design
  private defaultTargets: Record<string, number> = {
    grassland: 4,
    plains: 4,
    forest: 8,
    taiga: 6,
    tundra: 3,
    hills: 6,
    mountain: 3,
    mountains: 3,
    swamp: 7,
    marsh: 6,
    jungle: 9,
    desert: 2,
    beach: 2,
    coast: 2,
    tainted: 8,
  };

  constructor(
    private monsterService: MonsterService,
    private worldService: WorldService,
  ) {}

  private normalizeBiomeName(name?: string): string {
    return (name || 'unknown').toLowerCase();
  }

  private getTargetPer1000Tiles(biomeName: string): number {
    const key = this.normalizeBiomeName(biomeName);
    return this.defaultTargets[key] ?? 3; // fallback
  }

  // BiomeSpawnReport interface is exported at module scope above

  /**
   * Ensure populations in the area approach biome density targets.
   * Spawns at most maxSpawns to avoid spikes; focuses around player positions.
   */
  async enforceDensityAround(
    centerX: number,
    centerY: number,
    radiusTiles = 10,
    maxSpawns = 5,
  ): Promise<{ spawned: number; report: BiomeSpawnReport[] }> {
    const minX = centerX - radiusTiles;
    const maxX = centerX + radiusTiles;
    const minY = centerY - radiusTiles;
    const maxY = centerY + radiusTiles;
    // Note: area size used indirectly via tile counts per biome

    // Get world tiles in bounds with biomes
    const tiles = await this.worldService.getTilesInBounds(
      minX,
      maxX,
      minY,
      maxY,
    );
    // Count tiles per biome
    const biomeTileCounts = new Map<string, number>();
    for (const t of tiles) {
      const key = this.normalizeBiomeName(t.biomeName);
      biomeTileCounts.set(key, (biomeTileCounts.get(key) ?? 0) + 1);
    }

    // Get current monsters in bounds and count per biome
    const monsters = await this.monsterService.getMonstersInBounds(
      minX,
      maxX,
      minY,
      maxY,
    );
    const biomeMonsterCounts = new Map<string, number>();
    for (const m of monsters as Array<
      (typeof monsters)[number] & { biome?: { name: string } }
    >) {
      const key = this.normalizeBiomeName(m.biome?.name);
      biomeMonsterCounts.set(key, (biomeMonsterCounts.get(key) ?? 0) + 1);
    }

    // Compute deficits per biome and spawn toward targets
    let spawned = 0;
    const report: BiomeSpawnReport[] = [];
    const biomeKeys = Array.from(biomeTileCounts.keys());
    for (const biome of biomeKeys) {
      const tilesInBiome = biomeTileCounts.get(biome)!;
      const targetPer1000 = this.getTargetPer1000Tiles(biome);
      const targetCount = Math.ceil((tilesInBiome / 1000) * targetPer1000);
      const current = biomeMonsterCounts.get(biome) ?? 0;
      const deficit = Math.max(0, targetCount - current);
      if (deficit <= 0) continue;

      // Spawn in small groups until we reach maxSpawns budget
      const budget = Math.min(deficit, Math.max(1, maxSpawns - spawned));
      if (budget <= 0) break;

      // For each group, pick a random tile of that biome and spawn near it
      const candidateTiles = tiles.filter(
        (t) => this.normalizeBiomeName(t.biomeName) === biome,
      );
      let spawnedForBiome = 0;
      for (let i = 0; i < budget; i++) {
        if (candidateTiles.length === 0) break;
        const tile =
          candidateTiles[Math.floor(Math.random() * candidateTiles.length)];
        const group = await this.monsterService.spawnMonstersInArea(
          tile.x,
          tile.y,
          5,
          { maxGroupSize: 3 },
        );
        spawned += group.length;
        spawnedForBiome += group.length;
        if (spawned >= maxSpawns) break;
      }
      report.push({
        biome,
        tiles: tilesInBiome,
        targetPer1000,
        targetCount,
        current,
        deficit,
        spawned: spawnedForBiome,
      });
      if (spawned >= maxSpawns) break;
    }

    return { spawned, report };
  }
}
