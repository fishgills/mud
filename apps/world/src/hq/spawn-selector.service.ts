import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChunkGeneratorService } from '../world/chunk-generator.service';
import { WorldDatabaseService } from '../world/world-database.service';
import {
  HQ_MAX_RESPAWN_ATTEMPTS,
  HQ_MIN_RESPAWN_DISTANCE,
  HQ_RESPAWN_SEARCH_RADIUS,
} from './hq.constants';

interface SpawnCandidate {
  x: number;
  y: number;
  biomeName: string;
}

@Injectable()
export class SpawnSelectorService {
  private readonly logger = new Logger(SpawnSelectorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunkGenerator: ChunkGeneratorService,
    private readonly worldDatabase: WorldDatabaseService,
  ) {}

  async findSafeSpawn(
    excludePlayerId?: number,
    preferred?: { x: number; y: number } | null,
  ): Promise<SpawnCandidate> {
    const [seed, players] = await Promise.all([
      this.worldDatabase.loadWorldSeed(),
      this.prisma.player.findMany({
        where: {
          isAlive: true,
          isInHq: false,
          NOT: excludePlayerId ? { id: excludePlayerId } : undefined,
        },
        select: { x: true, y: true },
      }),
    ]);

    if (!players.length) {
      return this.validateOrFallback(seed, { x: 0, y: 0 });
    }

    if (preferred) {
      const preferredTile = this.validatePreferred(seed, preferred, players);
      if (preferredTile) {
        return preferredTile;
      }
    }

    for (let attempt = 0; attempt < HQ_MAX_RESPAWN_ATTEMPTS; attempt++) {
      const candidate = this.generateCandidate(players);
      if (!candidate) {
        continue;
      }

      const tile = this.chunkGenerator.generateTileAt(
        candidate.x,
        candidate.y,
        seed,
      );
      if (this.isWaterBiome(tile.biomeName)) {
        continue;
      }

      return {
        x: tile.x,
        y: tile.y,
        biomeName: tile.biomeName,
      };
    }

    return (
      this.findFarthestLand(seed, players) ?? this.validateOrFallback(seed)
    );
  }

  private generateCandidate(
    players: Array<{ x: number; y: number }>,
  ): { x: number; y: number } | null {
    let candidateX: number;
    let candidateY: number;

    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * HQ_RESPAWN_SEARCH_RADIUS;
    candidateX = Math.floor(Math.cos(angle) * distance);
    candidateY = Math.floor(Math.sin(angle) * distance);

    const farEnough = players.every((existing) => {
      const dx = candidateX - existing.x;
      const dy = candidateY - existing.y;
      return Math.sqrt(dx * dx + dy * dy) >= HQ_MIN_RESPAWN_DISTANCE;
    });

    return farEnough ? { x: candidateX, y: candidateY } : null;
  }

  private findFarthestLand(
    seed: number,
    players: Array<{ x: number; y: number }>,
  ): SpawnCandidate | null {
    if (!players.length) {
      return null;
    }

    let bestCandidate: SpawnCandidate | null = null;
    let maxMinDistance = 0;

    for (let attempt = 0; attempt < HQ_MAX_RESPAWN_ATTEMPTS; attempt++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * HQ_RESPAWN_SEARCH_RADIUS;
      const candidateX = Math.floor(Math.cos(angle) * distance);
      const candidateY = Math.floor(Math.sin(angle) * distance);

      const tile = this.chunkGenerator.generateTileAt(
        candidateX,
        candidateY,
        seed,
      );

      if (this.isWaterBiome(tile.biomeName)) {
        continue;
      }

      const minDistance = Math.min(
        ...players.map((existing) => {
          const dx = candidateX - existing.x;
          const dy = candidateY - existing.y;
          return Math.sqrt(dx * dx + dy * dy);
        }),
      );

      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestCandidate = {
          x: tile.x,
          y: tile.y,
          biomeName: tile.biomeName,
        };
      }
    }

    return bestCandidate;
  }

  private validatePreferred(
    seed: number,
    preferred: { x: number; y: number },
    players: Array<{ x: number; y: number }>,
  ): SpawnCandidate | null {
    const distanceOk = players.every((existing) => {
      const dx = preferred.x - existing.x;
      const dy = preferred.y - existing.y;
      return Math.sqrt(dx * dx + dy * dy) >= HQ_MIN_RESPAWN_DISTANCE;
    });

    if (!distanceOk) {
      return null;
    }

    try {
      const tile = this.chunkGenerator.generateTileAt(
        preferred.x,
        preferred.y,
        seed,
      );

      if (this.isWaterBiome(tile.biomeName)) {
        return null;
      }

      return {
        x: tile.x,
        y: tile.y,
        biomeName: tile.biomeName,
      };
    } catch (err) {
      this.logger.warn(
        `Failed to validate preferred spawn at (${preferred.x}, ${preferred.y}): ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private validateOrFallback(
    seed: number,
    fallback: { x: number; y: number } = { x: 0, y: 0 },
  ): SpawnCandidate {
    try {
      const tile = this.chunkGenerator.generateTileAt(
        fallback.x,
        fallback.y,
        seed,
      );
      if (!this.isWaterBiome(tile.biomeName)) {
        return {
          x: tile.x,
          y: tile.y,
          biomeName: tile.biomeName,
        };
      }
    } catch (err) {
      this.logger.warn(
        `Failed to validate fallback spawn at (${fallback.x}, ${fallback.y}): ${err instanceof Error ? err.message : err}`,
      );
    }

    return {
      x: 0,
      y: 0,
      biomeName: 'grassland',
    };
  }

  private isWaterBiome(biomeName?: string | null): boolean {
    if (!biomeName) return false;
    const normalized = biomeName.trim().toLowerCase();
    if (!normalized) return false;
    return (
      normalized.includes('ocean') ||
      normalized.includes('lake') ||
      normalized.includes('river') ||
      normalized.includes('water')
    );
  }
}
