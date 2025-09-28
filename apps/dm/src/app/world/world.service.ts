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

  async getTileInfo(x: number, y: number): Promise<WorldTile> {
    const defaultTile: WorldTile = {
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
      chunkX: Math.floor(x / WORLD_CHUNK_SIZE),
      chunkY: Math.floor(y / WORLD_CHUNK_SIZE),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await worldSdk.GetTile({
      x,
      y,
    });

    if (result?.getTile) {
      // Convert the GraphQL response to the expected WorldTile format
      const tile = result.getTile;
      return {
        id: tile.id,
        x: tile.x,
        y: tile.y,
        biomeId: tile.biomeId,
        biomeName: tile.biomeName,
        description: tile.description || defaultTile.description,
        height: tile.height,
        temperature: tile.temperature,
        moisture: tile.moisture,
        seed: tile.seed,
        chunkX: tile.chunkX,
        chunkY: tile.chunkY,
        createdAt: new Date(tile.createdAt),
        updatedAt: new Date(tile.updatedAt),
      };
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

      let tiles: WorldTile[] = [];
      if (result?.getChunk?.tiles) {
        // Convert GraphQL response to WorldTile format
        tiles = result.getChunk.tiles.map((tile) => ({
          // Fill minimal fields we actually use downstream for look
          id: 0,
          x: tile.x,
          y: tile.y,
          biomeId: 0,
          biomeName: tile.biomeName,
          description: '',
          height: tile.height,
          temperature: 0,
          moisture: 0,
          seed: 0,
          chunkX: Math.floor(tile.x / 50),
          chunkY: Math.floor(tile.y / 50),
          createdAt: new Date(),
          updatedAt: new Date(),
        }));
      }

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

  /** Fetch all tiles in [minX,maxX] x [minY,maxY] by combining overlapping chunks */
  async getTilesInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    chunkSize = WORLD_CHUNK_SIZE,
  ): Promise<WorldTile[]> {
    const minChunkX = Math.floor(minX / chunkSize);
    const maxChunkX = Math.floor(maxX / chunkSize);
    const minChunkY = Math.floor(minY / chunkSize);
    const maxChunkY = Math.floor(maxY / chunkSize);

    // Build list of unique chunk coords within the bounds
    const coords: Array<[number, number]> = [];
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        coords.push([cx, cy]);
      }
    }

    // Fetch all chunks in parallel (benefits from in-flight deduping & cache)
    const chunks = await Promise.all(
      coords.map(([cx, cy]) => this.getChunk(cx, cy)),
    );

    // Flatten and filter tiles by bounds
    const tiles = chunks
      .flat()
      .filter((t) => t.x >= minX && t.x <= maxX && t.y >= minY && t.y <= maxY);

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

    const defaultTile: WorldTile = {
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
      chunkX: Math.floor(x / WORLD_CHUNK_SIZE),
      chunkY: Math.floor(y / WORLD_CHUNK_SIZE),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const promise = (async () => {
      const result = await worldSdk.GetTileWithNearby({
        x,
        y,
      });

      let data: {
        tile: WorldTile;
        nearbyBiomes: NearbyBiome[];
        nearbySettlements: NearbySettlement[];
        currentSettlement?: Settlement;
      } = {
        tile: defaultTile,
        nearbyBiomes: [],
        nearbySettlements: [],
      };

      if (result?.getTile) {
        const tile = result.getTile;
        data = {
          tile: {
            id: tile.id,
            x: tile.x,
            y: tile.y,
            biomeId: tile.biomeId,
            biomeName: tile.biomeName,
            description: tile.description || defaultTile.description,
            height: tile.height,
            temperature: tile.temperature,
            moisture: tile.moisture,
            seed: tile.seed,
            chunkX: tile.chunkX,
            chunkY: tile.chunkY,
            createdAt: new Date(tile.createdAt),
            updatedAt: new Date(tile.updatedAt),
          },
          nearbyBiomes: tile.nearbyBiomes || [],
          nearbySettlements: tile.nearbySettlements || [],
          currentSettlement: tile.currentSettlement || undefined,
        };
      }

      this.centerNearbyCache.set(cacheKey, { data, ts: Date.now() });
      return data;
    })().finally(() => this.inflightCenterNearby.delete(cacheKey));

    this.inflightCenterNearby.set(cacheKey, promise);
    return promise;
  }
}
