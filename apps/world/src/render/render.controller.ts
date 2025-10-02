import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RenderService } from './render.service';
import { CacheService } from '../shared/cache.service';

@Controller('render')
export class RenderController {
  private readonly logger = new Logger(RenderController.name);
  constructor(
    private readonly renderService: RenderService,
    private readonly cache: CacheService,
  ) {}

  @Get('map.png')
  async getMapPng(
    @Res() res: Response,
    @Query('x') x?: string,
    @Query('y') y?: string,
    @Query('p') pixelWidth?: string,
  ) {
    const centerX = Number.isFinite(Number(x)) ? parseInt(x ?? '0', 10) : 0;
    const centerY = Number.isFinite(Number(y)) ? parseInt(y ?? '0', 10) : 0;
    const pStr = pixelWidth ?? '4';
    const p = Math.max(
      1,
      Math.floor(Number.isFinite(Number(pStr)) ? parseInt(pStr, 10) : 4),
    );

    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const cacheKey = `${minX},${minY},${maxX},${maxY},p=${p}`;
    const ttlMs = Number(process.env.WORLD_RENDER_CACHE_TTL_MS ?? 30000);

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
}
