import { Injectable, Logger } from '@nestjs/common';
import { WORLD_CHUNK_SIZE } from '@mud/constants';
import { authorizedFetch } from '@mud/gcp-auth';
import type {
  WorldTileDto,
  TileWithNearbyDto,
  NearbyBiomeDto,
  NearbySettlementDto,
  CurrentSettlementDto,
} from './dto/world.dto';
import { env } from '../../env';

export interface WorldTile
  extends Omit<WorldTileDto, 'createdAt' | 'updatedAt'> {
  createdAt: Date;
  updatedAt: Date;
}

export type NearbyBiome = NearbyBiomeDto;
export type NearbySettlement = NearbySettlementDto;
export type Settlement = CurrentSettlementDto;

interface ChunkResponseDto {
  chunkX: number;
  chunkY: number;
  tiles?: WorldTileDto[];
}

@Injectable()
export class WorldService {
  private readonly logger = new Logger(WorldService.name);
  private readonly baseUrl: string;

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
    const configuredUrl = env.WORLD_SERVICE_URL;
    this.baseUrl = configuredUrl.endsWith('/')
      ? configuredUrl.slice(0, -1)
      : configuredUrl;
    this.logger.log(`Using World REST endpoint at ${this.baseUrl}`);
  }

  private async httpGet<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const response = await authorizedFetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `World service ${response.status} ${response.statusText}: ${body}`,
      );
    }

    return (await response.json()) as T;
  }

  private parseTile(dto: WorldTileDto): WorldTile {
    return {
      ...dto,
      createdAt:
        dto.createdAt instanceof Date ? dto.createdAt : new Date(dto.createdAt),
      updatedAt:
        dto.updatedAt instanceof Date ? dto.updatedAt : new Date(dto.updatedAt),
    };
  }

  private parseTileWithNearby(dto: TileWithNearbyDto): {
    tile: WorldTile;
    nearbyBiomes: NearbyBiome[];
    nearbySettlements: NearbySettlement[];
    currentSettlement?: Settlement;
  } {
    const { nearbyBiomes, nearbySettlements, currentSettlement, ...rest } = dto;
    return {
      tile: this.parseTile(rest),
      nearbyBiomes,
      nearbySettlements,
      currentSettlement,
    };
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
      seed: 0,
      chunkX,
      chunkY,
      createdAt,
      updatedAt,
    };
  }

  private async fetchChunkTiles(
    chunkX: number,
    chunkY: number,
  ): Promise<WorldTile[]> {
    const chunk = await this.httpGet<ChunkResponseDto>(
      `/chunks/${chunkX}/${chunkY}?includeTiles=true`,
    );
    const tiles = chunk.tiles ?? [];
    return tiles.map((tile) => this.parseTile(tile));
  }

  async getTileInfo(x: number, y: number): Promise<WorldTile> {
    const defaultTile = this.createDefaultTile(x, y);
    try {
      const dto = await this.httpGet<WorldTileDto>(`/tiles/${x}/${y}`);
      return this.parseTile(dto);
    } catch (error) {
      this.logger.warn(
        `Falling back to default tile for (${x},${y}) due to error: ${error instanceof Error ? error.message : error}`,
      );
      return defaultTile;
    }
  }

  async getChunk(chunkX: number, chunkY: number): Promise<WorldTile[]> {
    const key = `${chunkX}:${chunkY}`;
    const cached = this.chunkCache.get(key);
    if (cached && Date.now() - cached.ts < this.CHUNK_CACHE_TTL_MS) {
      return cached.tiles;
    }

    const inflight = this.inflightChunkRequests.get(key);
    if (inflight) return inflight;

    const promise = (async () => {
      const tiles = await this.fetchChunkTiles(chunkX, chunkY);
      this.chunkCache.set(key, { tiles, ts: Date.now() });
      return tiles;
    })().finally(() => this.inflightChunkRequests.delete(key));

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
        if (dx === 0 && dy === 0) continue;
        tilePromises.push(this.getTileInfo(x + dx, y + dy));
      }
    }

    return Promise.all(tilePromises);
  }

  async getTilesInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<WorldTile[]> {
    const tiles = await this.httpGet<WorldTileDto[]>(
      `/bounds?minX=${minX}&maxX=${maxX}&minY=${minY}&maxY=${maxY}`,
    );
    return tiles.map((tile) => this.parseTile(tile));
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.httpGet<{ status: string }>(`/health`);
      return true;
    } catch (error) {
      this.logger.warn(
        `World health check failed: ${error instanceof Error ? error.message : error}`,
      );
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

    const promise = (async () => {
      try {
        const dto = await this.httpGet<TileWithNearbyDto>(
          `/tiles/${x}/${y}?includeNearby=true`,
        );
        const parsed = this.parseTileWithNearby(dto);
        this.centerNearbyCache.set(cacheKey, { data: parsed, ts: Date.now() });
        return parsed;
      } catch (error) {
        this.logger.warn(
          `Failed to fetch tile with nearby data for (${x},${y}): ${error instanceof Error ? error.message : error}`,
        );
        const fallback = {
          tile: this.createDefaultTile(x, y),
          nearbyBiomes: [],
          nearbySettlements: [],
        };
        this.centerNearbyCache.set(cacheKey, {
          data: fallback,
          ts: Date.now(),
        });
        return fallback;
      }
    })().finally(() => this.inflightCenterNearby.delete(cacheKey));

    this.inflightCenterNearby.set(cacheKey, promise);
    return promise;
  }
}
