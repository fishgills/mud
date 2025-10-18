import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import type {
  WorldTile,
  TileWithNearbyBiomes,
  ChunkData,
  PaginatedTiles,
} from './dto';
import {
  WorldService,
  NearestSettlementSummary,
} from './world-refactored.service';

@Controller()
export class WorldController {
  constructor(private readonly worldService: WorldService) {}

  @Get('health')
  health(): { status: string; timestamp: string } {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('settlements/nearest')
  async getNearestSettlement(
    @Query('x') xParam: string,
    @Query('y') yParam: string,
    @Query('maxRadius') maxRadiusParam?: string,
  ): Promise<{ settlement: NearestSettlementSummary | null }> {
    const x = Number.parseInt(xParam, 10);
    const y = Number.parseInt(yParam, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new BadRequestException('x and y must be integers');
    }

    let maxRadius: number | undefined;
    if (maxRadiusParam !== undefined) {
      maxRadius = Number.parseInt(maxRadiusParam, 10);
      if (Number.isNaN(maxRadius) || maxRadius < 0) {
        throw new BadRequestException('maxRadius must be a positive integer');
      }
    }

    const settlement = await this.worldService.findNearestSettlement(x, y, {
      maxRadius,
    });

    return { settlement };
  }

  @Get('tiles/:x/:y')
  async getTile(
    @Param('x') xParam: string,
    @Param('y') yParam: string,
    @Query('includeNearby') includeNearby?: string,
  ): Promise<WorldTile | TileWithNearbyBiomes> {
    const x = Number.parseInt(xParam, 10);
    const y = Number.parseInt(yParam, 10);
    if (Number.isNaN(x) || Number.isNaN(y)) {
      throw new BadRequestException('x and y must be integers');
    }

    const data = await this.worldService.getTileWithNearbyBiomes(x, y);
    const shouldIncludeNearby =
      includeNearby === 'true' || includeNearby === '1';

    if (shouldIncludeNearby) {
      return data;
    }

    const { nearbyBiomes, nearbySettlements, currentSettlement, ...tile } =
      data;
    void nearbyBiomes;
    void nearbySettlements;
    void currentSettlement;
    return tile;
  }

  @Get('chunks/:chunkX/:chunkY')
  async getChunk(
    @Param('chunkX') chunkXParam: string,
    @Param('chunkY') chunkYParam: string,
    @Query('includeTiles') includeTiles?: string,
  ): Promise<ChunkData> {
    const chunkX = Number.parseInt(chunkXParam, 10);
    const chunkY = Number.parseInt(chunkYParam, 10);
    if (Number.isNaN(chunkX) || Number.isNaN(chunkY)) {
      throw new BadRequestException('chunkX and chunkY must be integers');
    }

    const chunk = await this.worldService.getChunk(chunkX, chunkY);
    if (includeTiles === 'false' || includeTiles === '0') {
      return { ...chunk, tiles: undefined };
    }
    return chunk;
  }

  @Get('chunks/:chunkX/:chunkY/tiles')
  async getChunkTiles(
    @Param('chunkX') chunkXParam: string,
    @Param('chunkY') chunkYParam: string,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
  ): Promise<PaginatedTiles> {
    const chunkX = Number.parseInt(chunkXParam, 10);
    const chunkY = Number.parseInt(chunkYParam, 10);
    if (Number.isNaN(chunkX) || Number.isNaN(chunkY)) {
      throw new BadRequestException('chunkX and chunkY must be integers');
    }

    const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined;
    const offset = offsetParam ? Number.parseInt(offsetParam, 10) : undefined;

    if (
      (limit !== undefined && (Number.isNaN(limit) || limit < 0)) ||
      (offset !== undefined && Number.isNaN(offset))
    ) {
      throw new BadRequestException(
        'limit and offset must be positive integers when provided',
      );
    }

    const tiles = await this.worldService.getChunkTiles(
      chunkX,
      chunkY,
      limit,
      offset,
    );
    const totalCount = await this.worldService.getChunkTileCount(
      chunkX,
      chunkY,
    );
    const safeLimit = limit ?? tiles.length;
    const safeOffset = offset ?? 0;

    return {
      tiles,
      totalCount,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: safeOffset + safeLimit < totalCount,
    };
  }

  @Get('bounds')
  async getTilesInBounds(
    @Query('minX') minXParam: string,
    @Query('maxX') maxXParam: string,
    @Query('minY') minYParam: string,
    @Query('maxY') maxYParam: string,
  ): Promise<WorldTile[]> {
    const minX = Number.parseInt(minXParam, 10);
    const maxX = Number.parseInt(maxXParam, 10);
    const minY = Number.parseInt(minYParam, 10);
    const maxY = Number.parseInt(maxYParam, 10);

    if (
      [minX, maxX, minY, maxY].some((val) => Number.isNaN(val)) ||
      minX > maxX ||
      minY > maxY
    ) {
      throw new BadRequestException(
        'minX, maxX, minY, maxY must be valid integer ranges',
      );
    }

    return this.worldService.getTilesInBounds(minX, maxX, minY, maxY);
  }
}
