import { Controller, Delete, Get, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RenderService } from './render.service';
import { CacheService } from '../shared/cache.service';
import type { MapTileDto } from './map-tile.dto';

@Controller('render')
export class RenderController {
  private readonly logger = new Logger(RenderController.name);
  constructor(
    private readonly renderService: RenderService,
    private readonly cache: CacheService,
  ) {}

  private parseCenter(param: string | undefined): number {
    if (param === undefined) return 0;
    const n = Number.parseInt(param, 10);
    if (Number.isNaN(n)) {
      return 0;
    }
    return n;
  }

  private resolveBounds(x?: string, y?: string) {
    const centerX = this.parseCenter(x);
    const centerY = this.parseCenter(y);
    const half = 25;
    return {
      minX: centerX - half,
      maxX: centerX + half,
      minY: centerY - half,
      maxY: centerY + half,
    };
  }

  @Get('map.png')
  async getMapPng(
    @Res() res: Response,
    @Query('x') x?: string,
    @Query('y') y?: string,
    @Query('p') pixelWidth?: string,
  ) {
    const { minX, maxX, minY, maxY } = this.resolveBounds(x, y);
    const pStr = pixelWidth ?? '4';
    const p = Math.max(
      1,
      Math.floor(Number.isFinite(Number(pStr)) ? parseInt(pStr, 10) : 4),
    );

    const cacheKey = `${minX},${minY},${maxX},${maxY},p=${p}`;
    const ttlMs = 30000;

    const cached = await this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug(`PNG HTTP cache hit for ${cacheKey}`);
      const buf = Buffer.from(cached, 'base64');
      res.setHeader('Content-Type', 'image/png');
      res.setHeader(
        'Cache-Control',
        `public, max-age=${Math.floor(ttlMs / 1000)}`,
      );
      return res.send(buf);
    }
    this.logger.debug(
      `PNG HTTP cache MISS for ${cacheKey}; rendering via service`,
    );

    const tRenderStart = Date.now();
    const canvas = await this.renderService.renderMap(
      minX,
      maxX,
      minY,
      maxY,
      p,
    );
    const renderMs = Date.now() - tRenderStart;

    const tEncodeStart = Date.now();
    const base64 = canvas.toBuffer('image/png').toString('base64');
    const encodeMs = Date.now() - tEncodeStart;
    await this.cache.set(cacheKey, base64, ttlMs);
    const sizeKB = Math.round(((base64.length / 4) * 3) / 1024);
    this.logger.debug(
      `PNG HTTP cache SET for ${cacheKey} (ttlMs=${ttlMs}) renderMs=${renderMs} encodeMs=${encodeMs} sizeKB=${sizeKB}`,
    );

    const buf = Buffer.from(base64, 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.setHeader(
      'Cache-Control',
      `public, max-age=${Math.floor(ttlMs / 1000)}`,
    );
    return res.send(buf);
  }

  @Get('map-tiles')
  async getMapTiles(
    @Query('x') x?: string,
    @Query('y') y?: string,
  ): Promise<MapTileDto[][]> {
    const { minX, maxX, minY, maxY } = this.resolveBounds(x, y);
    const { tileData } = await this.renderService.prepareMapData(
      minX,
      maxX,
      minY,
      maxY,
    );

    const rows: MapTileDto[][] = [];
    for (let yVal = minY; yVal < maxY; yVal++) {
      const row: MapTileDto[] = [];
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

  @Get('map.ascii')
  async getMapAscii(
    @Query('x') x?: string,
    @Query('y') y?: string,
  ): Promise<{ ascii: string }> {
    const { minX, maxX, minY, maxY } = this.resolveBounds(x, y);
    const ascii = await this.renderService.renderMapAscii(
      minX,
      maxX,
      minY,
      maxY,
    );
    return { ascii };
  }

  @Delete('cache')
  async clearCache(
    @Query('pattern') pattern?: string,
  ): Promise<{ removed: number }> {
    const removed = pattern
      ? await this.cache.clearPattern(pattern)
      : await this.cache.clearAll();
    return { removed };
  }
}
