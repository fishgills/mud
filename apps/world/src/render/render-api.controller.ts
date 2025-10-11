import { Controller, Logger } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { worldContract } from '@mud/api-contracts';
import { RenderService } from './render.service';
import { CacheService } from '../shared/cache.service';

@Controller()
export class RenderApiController {
  private readonly logger = new Logger(RenderApiController.name);

  constructor(
    private readonly renderService: RenderService,
    private readonly cache: CacheService,
  ) {}

  private getBounds(
    x?: number,
    y?: number,
  ): { minX: number; maxX: number; minY: number; maxY: number } {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    return {
      minX: centerX - half,
      maxX: centerX + half,
      minY: centerY - half,
      maxY: centerY + half,
    };
  }

  @TsRestHandler(worldContract.renderMapTiles)
  async renderMapTiles() {
    return tsRestHandler(worldContract.renderMapTiles, ({ query }) =>
      this.handleRenderMapTiles(query.x, query.y),
    );
  }

  @TsRestHandler(worldContract.renderMapAscii)
  async renderMapAscii() {
    return tsRestHandler(worldContract.renderMapAscii, ({ query }) =>
      this.handleRenderMapAscii(query.x, query.y),
    );
  }

  @TsRestHandler(worldContract.renderMapPngBase64)
  async renderMapPngBase64() {
    return tsRestHandler(worldContract.renderMapPngBase64, ({ query }) =>
      this.handleRenderMapPngBase64(query.x, query.y, query.pixelsPerTile),
    );
  }

  private async handleRenderMapTiles(x?: number, y?: number) {
    const { minX, maxX, minY, maxY } = this.getBounds(x, y);
    const { tileData } = await this.renderService.prepareMapData(
      minX,
      maxX,
      minY,
      maxY,
    );

    const rows: Array<
      Array<{
        x: number;
        y: number;
        biomeName?: string;
        symbol?: string;
        hasSettlement: boolean;
        isSettlementCenter: boolean;
      }>
    > = [];

    for (let rowY = minY; rowY < maxY; rowY++) {
      const row: Array<{
        x: number;
        y: number;
        biomeName?: string;
        symbol?: string;
        hasSettlement: boolean;
        isSettlementCenter: boolean;
      }> = [];

      for (let colX = minX; colX < maxX; colX++) {
        const tileInfo = tileData.find((t) => t.x === colX && t.y === rowY);
        row.push({
          x: colX,
          y: rowY,
          biomeName: tileInfo?.biome?.name ?? undefined,
          symbol: tileInfo?.biome?.ascii ?? undefined,
          hasSettlement: !!tileInfo?.settlement,
          isSettlementCenter:
            !!tileInfo?.settlement &&
            tileInfo.settlement.x === colX &&
            tileInfo.settlement.y === rowY,
        });
      }

      rows.push(row);
    }

    return {
      status: 200 as const,
      body: rows,
    };
  }

  private async handleRenderMapAscii(x?: number, y?: number) {
    const { minX, maxX, minY, maxY } = this.getBounds(x, y);
    const ascii = await this.renderService.renderMapAscii(
      minX,
      maxX,
      minY,
      maxY,
    );
    return {
      status: 200 as const,
      body: { ascii },
    };
  }

  private async handleRenderMapPngBase64(
    x?: number,
    y?: number,
    pixelsPerTile?: number,
  ) {
    const { minX, maxX, minY, maxY } = this.getBounds(x, y);
    const p = pixelsPerTile ?? 4;
    const cacheKey = `${minX},${minY},${maxX},${maxY},p=${p}`;
    const ttlMs = Number(process.env.WORLD_RENDER_CACHE_TTL_MS ?? 30000);

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`PNG base64 cache hit for ${cacheKey}`);
      return {
        status: 200 as const,
        body: { imageBase64: cached },
      };
    }

    this.logger.debug(`PNG base64 cache MISS for ${cacheKey}`);
    const renderStart = Date.now();
    const canvas = await this.renderService.renderMap(
      minX,
      maxX,
      minY,
      maxY,
      p,
    );
    const renderMs = Date.now() - renderStart;
    const encodeStart = Date.now();
    const base64 = canvas.toBuffer('image/png').toString('base64');
    const encodeMs = Date.now() - encodeStart;

    await this.cache.set(cacheKey, base64, ttlMs);
    const sizeKB = Math.round(((base64.length / 4) * 3) / 1024);
    this.logger.debug(
      `PNG base64 cache SET for ${cacheKey} renderMs=${renderMs} encodeMs=${encodeMs} sizeKB=${sizeKB}`,
    );

    return {
      status: 200 as const,
      body: { imageBase64: base64 },
    };
  }
}
