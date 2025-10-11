import { Controller, Logger } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import {
  worldContract,
  type WorldTile as ApiWorldTile,
  type TileWithNearby as ApiTileWithNearby,
  type ChunkData as ApiChunkData,
  type Settlement as ApiSettlement,
} from '@mud/api-contracts';
import type {
  WorldTile as InternalWorldTile,
  TileWithNearbyBiomes as InternalTileWithNearby,
  Settlement as InternalSettlement,
} from './models';
import { WorldService } from './world-refactored.service';

@Controller()
export class WorldApiController {
  private readonly logger = new Logger(WorldApiController.name);

  constructor(private readonly worldService: WorldService) {}

  private toIso(value: Date | string | number | null | undefined): string {
    if (value instanceof Date) {
      return value.toISOString();
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    return new Date(0).toISOString();
  }

  private serializeTile(tile: InternalWorldTile): ApiWorldTile {
    return {
      id: tile.id,
      x: tile.x,
      y: tile.y,
      biomeId: tile.biomeId,
      biomeName: tile.biomeName,
      description: tile.description ?? null,
      height: tile.height,
      temperature: tile.temperature,
      moisture: tile.moisture,
      seed: tile.seed,
      chunkX: tile.chunkX,
      chunkY: tile.chunkY,
      createdAt: this.toIso(tile.createdAt),
      updatedAt: this.toIso(tile.updatedAt),
      biome: tile.biome
        ? {
            id: tile.biome.id,
            name: tile.biome.name,
          }
        : undefined,
    };
  }

  private serializeTileWithNearby(
    tile: InternalTileWithNearby,
  ): ApiTileWithNearby {
    const baseTile = this.serializeTile(tile);
    return {
      ...baseTile,
      nearbyBiomes: tile.nearbyBiomes ?? [],
      nearbySettlements: tile.nearbySettlements ?? [],
      currentSettlement: tile.currentSettlement,
    };
  }

  private serializeSettlement(settlement: InternalSettlement): ApiSettlement {
    return {
      id: settlement.id,
      name: settlement.name,
      type: settlement.type,
      x: settlement.x,
      y: settlement.y,
      size: settlement.size,
      population: settlement.population,
      description: settlement.description,
      createdAt: this.toIso(settlement.createdAt),
      updatedAt: this.toIso(settlement.updatedAt),
    };
  }

  @TsRestHandler(worldContract.health)
  async health() {
    return tsRestHandler(worldContract.health, () => this.handleHealth());
  }

  @TsRestHandler(worldContract.getTile)
  async getTile() {
    return tsRestHandler(worldContract.getTile, (args) =>
      this.handleGetTile(args.params.x, args.params.y),
    );
  }

  @TsRestHandler(worldContract.getChunk)
  async getChunk() {
    return tsRestHandler(worldContract.getChunk, ({ params, query }) =>
      this.handleGetChunk(params.chunkX, params.chunkY, query ?? {}),
    );
  }

  @TsRestHandler(worldContract.getTilesInBounds)
  async getTilesInBounds() {
    return tsRestHandler(worldContract.getTilesInBounds, ({ query }) =>
      this.handleGetTilesInBounds(query.minX, query.maxX, query.minY, query.maxY),
    );
  }

  private async handleHealth() {
    return {
      status: 200 as const,
      body: {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
      },
    };
  }

  private async handleGetTile(x: number, y: number) {
    const tile = await this.worldService.getTileWithNearbyBiomes(x, y);
    return {
      status: 200 as const,
      body: this.serializeTileWithNearby(tile),
    };
  }

  private async handleGetChunk(
    chunkX: number,
    chunkY: number,
    query: {
      limit?: number;
      offset?: number;
      includeSettlements?: boolean;
      includeStats?: boolean;
      includeBiomeStats?: boolean;
    },
  ) {
    const {
      limit,
      offset,
      includeSettlements = true,
      includeStats = true,
      includeBiomeStats = true,
    } = query;

    const tiles = await this.worldService.getChunkTiles(chunkX, chunkY);
    const serializedTiles = tiles.map((tile) => this.serializeTile(tile));

    const chunkResponse: ApiChunkData = {
      chunkX,
      chunkY,
      tiles: serializedTiles,
    };

    if (typeof limit === 'number') {
      const start = Math.max(0, offset ?? 0);
      const end = Math.min(start + limit, serializedTiles.length);
      const pageTiles = serializedTiles.slice(start, end);
      chunkResponse.paginatedTiles = {
        tiles: pageTiles,
        totalCount: await this.worldService.getChunkTileCount(chunkX, chunkY),
        offset: start,
        limit,
        hasMore: end < serializedTiles.length,
      };
    }

    if (includeSettlements) {
      const settlements = await this.worldService.getChunkSettlements(
        chunkX,
        chunkY,
      );
      chunkResponse.settlements = settlements.map((settlement) =>
        this.serializeSettlement(settlement),
      );
    }

    if (includeStats) {
      const stats = await this.worldService.getChunkStats(chunkX, chunkY);
      chunkResponse.stats = {
        averageHeight: stats.averageHeight,
        averageTemperature: stats.averageTemperature,
        averageMoisture: stats.averageMoisture,
      };
    }

    if (includeBiomeStats) {
      const biomeStats = await this.worldService.getChunkBiomeStats(
        chunkX,
        chunkY,
      );
      chunkResponse.biomeStats = biomeStats;
    }

    return {
      status: 200 as const,
      body: chunkResponse,
    };
  }

  private async handleGetTilesInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ) {
    const tiles = await this.worldService.getTilesInBounds(
      minX,
      maxX,
      minY,
      maxY,
    );

    return {
      status: 200 as const,
      body: tiles.map((tile) => this.serializeTile(tile)),
    };
  }
}
