import { Args, Query, Resolver, Int, Mutation } from '@nestjs/graphql';
import { RenderService } from './render.service';
import { Injectable, Logger } from '@nestjs/common';
import { MapTile } from './map-tile.model';
import { CacheService } from '../shared/cache.service';

@Resolver()
@Injectable()
export class RenderResolver {
  private logger = new Logger(RenderResolver.name);
  constructor(
    private readonly renderService: RenderService,
    private readonly cache: CacheService,
  ) {}

  @Query(() => [[MapTile]], {
    description:
      'Returns a 2D array of map tiles for a 50x50 region centered on (x, y).',
  })
  async renderMapTiles(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<MapTile[][]> {
    this.logger.debug(`Rendering map tiles centered at (${x}, ${y})`);
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    // Get tile data from the render service
    const { tileData } = await this.renderService.prepareMapData(
      minX,
      maxX,
      minY,
      maxY,
    );
    // Build a 2D array (rows by y, columns by x)
    const rows: MapTile[][] = [];
    for (let yVal = minY; yVal < maxY; yVal++) {
      const row: MapTile[] = [];
      for (let xVal = minX; xVal < maxX; xVal++) {
        const tileInfo = tileData.find((t) => t.x === xVal && t.y === yVal);
        row.push({
          x: xVal,
          y: yVal,
          biomeName: tileInfo?.biome?.name ?? undefined,
          symbol: tileInfo?.biome?.ascii ?? undefined,
          hasSettlement: !!tileInfo?.settlement,
          isSettlementCenter:
            !!tileInfo?.settlement &&
            tileInfo.settlement.x === xVal &&
            tileInfo.settlement.y === yVal,
        });
      }
      rows.push(row);
    }
    return rows;
  }

  @Query(() => String, {
    description: 'Returns an ASCII map centered on (x, y) with a 50x50 region.',
  })
  async renderMapAscii(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<string> {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    return this.renderService.renderMapAscii(minX, maxX, minY, maxY);
  }

  // Note: Binary image (PNG) is not directly supported in GraphQL, so we return a base64 string
  @Query(() => String, {
    description:
      'Returns a PNG map centered on (x, y) as a base64 string (50x50 region).',
  })
  async renderMapPngBase64(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
    @Args('pixelsPerTile', {
      type: () => Int,
      nullable: true,
      description: 'Pixels per tile (resolution scalar), default 4',
    })
    pixelsPerTile?: number,
  ): Promise<string> {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const p = pixelsPerTile ?? 4;
    const cacheKey = `${minX},${minY},${maxX},${maxY},p=${p}`;
    const ttlMs = Number(process.env.WORLD_RENDER_CACHE_TTL_MS ?? 30000);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`PNG cache hit for ${cacheKey}`);
      return cached;
    }
    this.logger.debug(`PNG cache MISS for ${cacheKey}; rendering via service`);
    const canvas = await this.renderService.renderMap(
      minX,
      maxX,
      minY,
      maxY,
      p,
    );
    const base64 = canvas.toBuffer('image/png').toString('base64');
    await this.cache.set(cacheKey, base64, ttlMs);
    this.logger.debug(`PNG cache SET for ${cacheKey} (ttlMs=${ttlMs})`);
    return base64;
  }

  @Mutation(() => Int, {
    description:
      'Clears the render cache in Redis. Returns number of keys removed.',
  })
  async clearRenderCache(
    @Args('pattern', {
      type: () => String,
      nullable: true,
      description:
        'Optional suffix glob pattern (without prefix). Example: "*" or "*,p=4" to clear only p=4 entries.',
    })
    pattern?: string,
  ): Promise<number> {
    if (!pattern) {
      this.logger.warn('Clearing entire render cache');
      return this.cache.clearAll();
    }
    this.logger.warn(`Clearing render cache with pattern: ${pattern}`);
    return this.cache.clearPattern(pattern);
  }
}
