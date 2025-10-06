import { Injectable, Logger } from '@nestjs/common';
import { worldSdk } from '../gql-client';
import { WorldTile } from '../../generated/world-graphql';
import { WORLD_CHUNK_SIZE } from '@mud/constants';
export interface Biome {
  id: number;
  name: string;
}

export interface NearbyBiome {
  biomeName: string;
  distance: number;
  direction: string;
}

export interface NearbySettlement {
  name: string;
  type: string;
  size: string;
  population: number;
  x: number;
  y: number;
  description: string;
  distance: number;
}

export interface Settlement {
  name: string;
  type: string;
  size: string;
  intensity: number;
  isCenter: boolean;
}

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private readonly worldServiceUrl =
    process.env.WORLD_SERVICE_URL || 'http://localhost:3000';
  // Simple in-memory cache and in-flight dedupe for chunk requests
  private readonly chunkCache = new Map<
    string,
    { tiles: WorldTile[]; ts: number }
  >();
  private readonly inflightChunkRequests = new Map<
    string,
    Promise<WorldTile[]>
  >();
  private readonly CHUNK_CACHE_TTL_MS = Number.parseInt(
    process.env.DM_CHUNK_CACHE_TTL_MS || '30000',
    10,
  );
  // Center-with-nearby cache and inflight dedupe
  private readonly centerNearbyCache = new Map<
    string,
    {
      data: {
        tile: WorldTile;
        nearbyBiomes: NearbyBiome[];
        nearbySettlements: NearbySettlement[];
        currentSettlement?: Settlement;
      };
      ts: number;
    }
  >();
  private readonly inflightCenterNearby = new Map<
    string,
    Promise<{
      tile: WorldTile;
      nearbyBiomes: NearbyBiome[];
      nearbySettlements: NearbySettlement[];
      currentSettlement?: Settlement;
    }>
  >();
  private readonly CENTER_NEARBY_CACHE_TTL_MS = Number.parseInt(
    process.env.DM_CENTER_NEARBY_CACHE_TTL_MS || '30000',
    10,
  );

  constructor() {
    // Ensure URL doesn't have double slashes
    const baseUrl = this.worldServiceUrl.endsWith('/')
      ? this.worldServiceUrl.slice(0, -1)
      : this.worldServiceUrl;
    const graphqlUrl = `${baseUrl}/graphql`;

    this.logger.log(`Initializing GraphQL client with URL: ${graphqlUrl}`);
  }

  private createDefaultTile(x: number, y: number): WorldTile {
    const chunkX = Math.floor(x / WORLD_CHUNK_SIZE);
    const chunkY = Math.floor(y / WORLD_CHUNK_SIZE);
    const createdAt = new Date();
    const updatedAt = new Date();
    return {
      id: 0,
      x,
      y,
      biomeId: 1,
      biomeName: 'grassland',
      description: '',
      height: 0.5,
      temperature: 0.6,
      moisture: 0.5,
      seed: 12345,
      chunkX,
      chunkY,
      createdAt,
      updatedAt,
    };
  }

  private mapGraphqlTile(
    tile: {
      id?: number;
      x?: number;
      y?: number;
      biomeId?: number;
      biomeName?: string;
      description?: string | null;
      height?: number;
      temperature?: number;
      moisture?: number;
      seed?: number;
      chunkX?: number;
      chunkY?: number;
      createdAt?: string | Date | null;
      updatedAt?: string | Date | null;
    },
    fallback: WorldTile,
  ): WorldTile {
    return {
      ...fallback,
      id: tile.id ?? fallback.id,
      x: tile.x ?? fallback.x,
      y: tile.y ?? fallback.y,
      biomeId: tile.biomeId ?? fallback.biomeId,
      biomeName: tile.biomeName ?? fallback.biomeName,
      description: tile.description ?? fallback.description,
      height: tile.height ?? fallback.height,
      temperature: tile.temperature ?? fallback.temperature,
      moisture: tile.moisture ?? fallback.moisture,
      seed: tile.seed ?? fallback.seed,
      chunkX: tile.chunkX ?? fallback.chunkX,
      chunkY: tile.chunkY ?? fallback.chunkY,
      createdAt:
        tile.createdAt instanceof Date
          ? tile.createdAt
          : tile.createdAt
            ? new Date(tile.createdAt)
            : fallback.createdAt,
      updatedAt:
        tile.updatedAt instanceof Date
          ? tile.updatedAt
          : tile.updatedAt
            ? new Date(tile.updatedAt)
            : fallback.updatedAt,
    };
  }

  private createLightweightTile(tile: {
    x: number;
    y: number;
    biomeName?: string | null;
    height?: number | null;
  }): WorldTile {
    const base = this.createDefaultTile(tile.x, tile.y);
    return {
      ...base,
      id: 0,
      biomeId: 0,
      biomeName: tile.biomeName ?? base.biomeName,
      description: '',
      height: tile.height ?? base.height,
      temperature: 0,
      moisture: 0,
      seed: 0,
    };
  }

  async getTileInfo(x: number, y: number): Promise<WorldTile> {
    const defaultTile = this.createDefaultTile(x, y);

    const result = await worldSdk.GetTile({
      x,
      y,
    });

    if (result?.getTile) {
      // Convert the GraphQL response to the expected WorldTile format
      return this.mapGraphqlTile(result.getTile, defaultTile);
    }

    return defaultTile;
  }

  async getChunk(chunkX: number, chunkY: number): Promise<WorldTile[]> {
    const key = `${chunkX}:${chunkY}`;

    // Serve from cache if fresh
    const cached = this.chunkCache.get(key);
    if (cached && Date.now() - cached.ts < this.CHUNK_CACHE_TTL_MS) {
      return cached.tiles;
    }

    // Deduplicate concurrent requests for the same chunk
    const inflight = this.inflightChunkRequests.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const result = await worldSdk.GetChunk({ chunkX, chunkY });

      const tiles: WorldTile[] = result?.getChunk?.tiles
        ? result.getChunk.tiles.map((tile) =>
            this.createLightweightTile({
              x: tile.x,
              y: tile.y,
              biomeName: tile.biomeName,
              height: tile.height,
            }),
          )
        : [];

      // cache the result (even empty) to avoid hammering
      this.chunkCache.set(key, { tiles, ts: Date.now() });
      return tiles;
    })().finally(() => {
      // clear inflight regardless of success/failure
      this.inflightChunkRequests.delete(key);
    });

    this.inflightChunkRequests.set(key, promise);
    return promise;
  }

  async getSurroundingTiles(
    x: number,
    y: number,
    radius = 1,
  ): Promise<WorldTile[]> {
    const tilePromises: Promise<WorldTile>[] = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        // Skip the center tile (current player position)
        if (dx === 0 && dy === 0) continue;

        tilePromises.push(this.getTileInfo(x + dx, y + dy));
      }
    }

    return Promise.all(tilePromises);
  }

  /** Fetch tiles in [minX,maxX] x [minY,maxY] directly from World in a single query. */
  async getTilesInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<WorldTile[]> {
    // Fallback implementation using chunk queries to cover the bounds
    // Compute chunk coverage
    const minChunkX = Math.floor(minX / WORLD_CHUNK_SIZE);
    const maxChunkX = Math.floor(maxX / WORLD_CHUNK_SIZE);
    const minChunkY = Math.floor(minY / WORLD_CHUNK_SIZE);
    const maxChunkY = Math.floor(maxY / WORLD_CHUNK_SIZE);

    const chunkCoords: Array<{ chunkX: number; chunkY: number }> = [];
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        chunkCoords.push({ chunkX: cx, chunkY: cy });
      }
    }

    // Fetch each chunk's lightweight tiles and filter to bounds
    const chunks = await Promise.all(
      chunkCoords.map(({ chunkX, chunkY }) =>
        worldSdk.GetChunk({ chunkX, chunkY }),
      ),
    );

    const tiles: WorldTile[] = chunks
      .flatMap((c) => c.getChunk.tiles ?? [])
      .filter((t) => t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY)
      .map((tile) =>
        this.createLightweightTile({
          x: tile.x,
          y: tile.y,
          biomeName: tile.biomeName,
          height: tile.height,
        }),
      );

    return tiles;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const result = await worldSdk.HealthCheck();

      return result !== null;
    } catch {
      return false;
    }
  }

  async getTileInfoWithNearby(
    x: number,
    y: number,
  ): Promise<{
    tile: WorldTile;
    nearbyBiomes: NearbyBiome[];
    nearbySettlements: NearbySettlement[];
    currentSettlement?: Settlement;
  }> {
    const cacheKey = `${x}:${y}`;
    const cached = this.centerNearbyCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this.CENTER_NEARBY_CACHE_TTL_MS) {
      return cached.data;
    }

    const inflight = this.inflightCenterNearby.get(cacheKey);
    if (inflight) return inflight;

    const defaultTile = this.createDefaultTile(x, y);

    const promise = (async () => {
      const result = await worldSdk.GetTileWithNearby({
        x,
        y,
      });

      const data: {
        tile: WorldTile;
        nearbyBiomes: NearbyBiome[];
        nearbySettlements: NearbySettlement[];
        currentSettlement?: Settlement;
      } = result?.getTile
        ? {
            tile: this.mapGraphqlTile(result.getTile, defaultTile),
            nearbyBiomes: result.getTile.nearbyBiomes || [],
            nearbySettlements: result.getTile.nearbySettlements || [],
            currentSettlement: result.getTile.currentSettlement || undefined,
          }
        : {
            tile: defaultTile,
            nearbyBiomes: [],
            nearbySettlements: [],
          };

      this.centerNearbyCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    })().finally(() => this.inflightCenterNearby.delete(cacheKey));

    this.inflightCenterNearby.set(cacheKey, promise);
    return promise;
  }
}
