import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'pureimage';
import {
  bitmapToPngBase64,
  createRenderBitmap,
  decodePngBase64,
  RenderBitmap,
} from './image-utils';
import { drawHeightShading } from './graphics';
import { BIOMES } from '../constants';
import { WorldService } from '../world/world-refactored.service';
import { CacheService } from '../shared/cache.service';
import { GridMapGenerator } from '../gridmap/gridmap-generator';
import { DEFAULT_BIOMES } from '../gridmap/default-biomes';
import { buildGridConfigs, deriveTemperature } from '../gridmap/utils';
import { mapGridBiomeToBiomeInfo } from '../gridmap/biome-mapper';
import { WORLD_CHUNK_SIZE, BiomeId } from '@mud/constants';
import { WorldTile } from 'src/world/dto';
import { SpriteService, SPRITE_TILE_SIZE } from './sprites/sprite.service';

type ComputedTile = {
  x: number;
  y: number;
  biomeId: number;
  biomeName: string;
  description: string | null;
  height: number;
  temperature: number;
  moisture: number;
  seed: number;
  chunkX: number;
  chunkY: number;
  createdAt: Date;
  updatedAt: Date;
};
@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
  private readonly RENDER_STYLE_VERSION = 4; // bump to invalidate cached chunk PNGs when style changes (v4: sprite-based rendering)
  constructor(
    private readonly worldService: WorldService,
    private readonly cache: CacheService,
    private readonly spriteService: SpriteService,
  ) {}

  async renderMap(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    pixelsPerTile = 4,
  ) {
    const chunkSize = WORLD_CHUNK_SIZE;
    // Attempt fast path: compose from cached chunk PNGs if all present
    const p = Math.max(1, Math.floor(pixelsPerTile));
    this.logger.debug(
      `Attempting chunk-compose: bounds=(${minX},${minY})-(${maxX - 1},${
        maxY - 1
      }), p=${p}`,
    );
    const composed = await this.composeFromChunkCache(
      minX,
      maxX,
      minY,
      maxY,
      p,
      chunkSize,
    );
    if (composed) {
      this.logger.debug('Chunk-compose success; returning composed canvas');
      return composed;
    }
    this.logger.debug('Chunk-compose unavailable; falling back to full render');

    // Fallback path: render computed tiles without touching the database
    const { canvas, existingTileCount, width, height } =
      await this.renderRegionCanvas(minX, maxX, minY, maxY, p, {
        includeCenterMarker: true,
      });

    // Opportunistically pre-populate chunk PNG cache for next renders (non-blocking)
    this.prewarmChunkPngCache(minX, maxX, minY, maxY, p, chunkSize).catch((e) =>
      this.logger.warn(`Prewarm failed: ${e?.message ?? e}`),
    );

    this.logger.log(
      `Rendered map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates`,
    );
    return canvas;
  }

  // Visual helpers extracted to ./graphics

  // Shared region renderer used by both full renders and chunk renders
  private async renderRegionCanvas(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    p: number,
    opts: { includeCenterMarker: boolean },
  ): Promise<{
    canvas: RenderBitmap;
    width: number;
    height: number;
    existingTileCount: number;
  }> {
    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    const canvas = createRenderBitmap(width * p, height * p);
    const ctx = canvas.getContext('2d');
    // Background
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center marker location (tile space)
    const centerTileX = minX + Math.floor((maxX - minX) / 2);
    const centerTileY = minY + Math.floor((maxY - minY) / 2);

    // Biome map for edges + height map for lighting
    const biomeMap = new Map<
      string,
      (typeof BIOMES)[keyof typeof BIOMES] | null
    >();
    const heightMap = new Map<string, number>();
    for (const t of tileData) {
      const key = `${t.x},${t.y}`;
      biomeMap.set(key, t.biome);
      if (typeof t.tile?.height === 'number') {
        heightMap.set(key, t.tile.height);
      }
    }

    // Sprite-based rendering
    const spriteScale = p / SPRITE_TILE_SIZE;

    for (const { x, y, tile, biome } of tileData) {
      const pixelX = (x - minX) * p;
      const pixelY = (maxY - 1 - y) * p; // invert Y

      if (tile && biome) {
        // Draw the biome sprite
        this.spriteService.drawSpriteWithVariation(
          ctx,
          pixelX,
          pixelY,
          spriteScale,
          biome.id as BiomeId,
          x,
          y,
        );
        // Add height-based shading for terrain depth
        drawHeightShading(ctx, pixelX, pixelY, p, x, y, heightMap);
      }
    }

    if (opts.includeCenterMarker) {
      const centerPixelX = (centerTileX - minX) * p;
      const centerPixelY = (maxY - 1 - centerTileY) * p;
      this.drawCenterMarker(ctx, centerPixelX, centerPixelY, p);
    }

    return { canvas, width, height, existingTileCount };
  }

  // draw helpers are imported from './graphics'

  private drawCenterMarker(
    ctx: Context,
    pixelX: number,
    pixelY: number,
    p: number,
  ) {
    if (p < 4) {
      const lw = Math.max(1, Math.floor(p / 4));
      ctx.lineWidth = lw;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeRect(pixelX + 0.5, pixelY + 0.5, p - 1, p - 1);
      return;
    }

    ctx.save();
    const cx = pixelX + p / 2;
    const cy = pixelY + p / 2;
    const radius = Math.max(1.5, p / 2.6);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = Math.max(1, Math.floor(p / 6));
    ctx.beginPath();
    ctx.arc(cx, cy, radius + Math.max(1, p / 8), 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, Math.floor(p / 8));
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - radius, cy);
    ctx.lineTo(cx + radius, cy);
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx, cy + radius);
    ctx.stroke();
    ctx.restore();
  }

  private chunkKey(chunkX: number, chunkY: number, p: number) {
    return `chunk:png:v${this.RENDER_STYLE_VERSION}:${chunkX},${chunkY},p=${p}`;
  }

  private async getChunkPngBase64(
    chunkX: number,
    chunkY: number,
    p: number,
  ): Promise<string> {
    const key = this.chunkKey(chunkX, chunkY, p);
    const cached = await this.cache.get(key);
    if (cached) {
      this.logger.debug(`[chunkpng HIT] ${key}`);
      return cached;
    }
    this.logger.debug(`[chunkpng MISS] ${key}`);

    const startX = chunkX * 50;
    const startY = chunkY * 50;
    const endX = startX + 50;
    const endY = startY + 50;

    const tRenderStart = Date.now();
    const { canvas, width, height } = await this.renderRegionCanvas(
      startX,
      endX,
      startY,
      endY,
      p,
      { includeCenterMarker: false },
    );
    const renderMs = Date.now() - tRenderStart;

    const tEncodeStart = Date.now();
    const base64 = await bitmapToPngBase64(canvas);
    const encodeMs = Date.now() - tEncodeStart;
    // Cache with same TTL as region cache
    const ttlMs = Number(30000);
    await this.cache.set(key, base64, ttlMs);
    const sizeKB = Math.round(((base64.length / 4) * 3) / 1024);
    this.logger.debug(
      `[chunkpng SET] ${key} ttlMs=${ttlMs} renderMs=${renderMs} encodeMs=${encodeMs} sizeKB=${sizeKB} wh=${width}x${height}`,
    );
    return base64;
  }

  private async composeFromChunkCache(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    p: number,
    chunkSize: number,
  ) {
    const t0 = Date.now();
    const width = maxX - minX;
    const height = maxY - minY;
    const canvas = createRenderBitmap(width * p, height * p);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const minChunkX = Math.floor(minX / chunkSize);
    const maxChunkX = Math.floor((maxX - 1) / chunkSize);
    const minChunkY = Math.floor(minY / chunkSize);
    const maxChunkY = Math.floor((maxY - 1) / chunkSize);

    // Load all chunk images from cache; if any missing, abort fast path
    const needed: Array<{ cx: number; cy: number; imgB64: string } | null> = [];
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        const key = this.chunkKey(cx, cy, p);
        const b64 = await this.cache.get(key);
        if (!b64) {
          this.logger.debug(`[chunkpng MISS] during compose -> ${key}`);
          return null;
        }
        this.logger.debug(`[chunkpng HIT] during compose -> ${key}`);
        needed.push({ cx, cy, imgB64: b64 });
      }
    }
    const fetchMs = Date.now() - t0;

    // Pre-decode all chunk images in parallel to reduce latency
    const tDecodeStart = Date.now();
    const decoded: Array<{ cx: number; cy: number; img: RenderBitmap } | null> =
      await Promise.all(
        needed.map((n) =>
          n
            ? decodePngBase64(n.imgB64).then((img) => ({
                cx: n.cx,
                cy: n.cy,
                img,
              }))
            : Promise.resolve(null),
        ),
      );
    const decodeMs = Date.now() - tDecodeStart;

    // Draw the relevant sub-rectangles of each chunk image
    const tDrawStart = Date.now();
    for (const entry of decoded) {
      if (!entry) continue;
      const { cx, cy, img } = entry;
      const startX = cx * chunkSize;
      const startY = cy * chunkSize;
      const endX = startX + chunkSize;
      const endY = startY + chunkSize;

      // Intersection in tile coords
      const ix0 = Math.max(minX, startX);
      const ix1 = Math.min(maxX, endX);
      const iy0 = Math.max(minY, startY);
      const iy1 = Math.min(maxY, endY);
      if (ix1 <= ix0 || iy1 <= iy0) continue;

      // Source rect within chunk image (note Y inversion)
      const sx = (ix0 - startX) * p;
      const sy = (endY - iy1) * p; // top corresponds to highest y
      const sw = (ix1 - ix0) * p;
      const sh = (iy1 - iy0) * p;

      // Destination rect within final canvas (also inverted Y for region)
      const dx = (ix0 - minX) * p;
      const dy = (maxY - iy1) * p;
      const dw = sw;
      const dh = sh;

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    const drawMs = Date.now() - tDrawStart;

    // Draw distinct PLAYER marker (white outline) on exact center tile of the region
    const centerTileX = minX + Math.floor((maxX - minX) / 2);
    const centerTileY = minY + Math.floor((maxY - minY) / 2);
    const centerPixelX = (centerTileX - minX) * p;
    const centerPixelY = (maxY - 1 - centerTileY) * p;
    this.drawCenterMarker(ctx, centerPixelX, centerPixelY, p);

    const totalMs = Date.now() - t0;
    this.logger.debug(
      `[chunkpng COMPOSE] chunks=${needed.length} fetchMs=${fetchMs} decodeMs=${decodeMs} drawMs=${drawMs} totalMs=${totalMs}`,
    );
    return canvas;
  }

  private async prewarmChunkPngCache(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    p: number,
    chunkSize: number,
  ) {
    const minChunkX = Math.floor(minX / chunkSize);
    const maxChunkX = Math.floor((maxX - 1) / chunkSize);
    const minChunkY = Math.floor(minY / chunkSize);
    const maxChunkY = Math.floor((maxY - 1) / chunkSize);
    const chunkCoordinates: Array<{ cx: number; cy: number }> = [];
    const tasks: Array<Promise<string>> = [];
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        chunkCoordinates.push({ cx, cy });
        tasks.push(this.getChunkPngBase64(cx, cy, p));
      }
    }
    const results = await Promise.allSettled(tasks);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const coord = chunkCoordinates[index];
        const reason =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);
        this.logger.debug(
          `[chunkpng PREWARM FAIL] (${coord.cx},${coord.cy},p=${p}): ${reason}`,
        );
      }
    });
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const total = results.length;
    this.logger.debug(`[chunkpng PREWARM DONE] ${ok}/${total} chunks ready`);
  }

  async renderMapAscii(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<string> {
    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    let asciiMap = '';

    // Add a header with coordinate information
    asciiMap += `ASCII Map (${minX},${minY}) to (${maxX - 1},${maxY - 1})\n`;
    asciiMap += `Legend: ~ Ocean, ≈ Shallow Ocean, . Beach, d Desert, g Grassland, T Forest\n`;
    asciiMap += `        J Jungle, S Swamp, L Lake, r River, t Tundra, P Taiga\n`;
    asciiMap += `        ^ Mountain, A Snowy Mountain, h Hills, s Savanna, a Alpine, V Volcanic\n`;
    asciiMap += `        • Ungenerated area\n\n`;

    // Render each row
    for (let y = minY; y < maxY; y++) {
      let row = '';
      for (let x = minX; x < maxX; x++) {
        const tileInfo = tileData.find((t) => t.x === x && t.y === y);
        if (!tileInfo) continue;

        const { tile, biome, hasError } = tileInfo;

        if (tile && biome) {
          row += biome.ascii;
        } else if (hasError) {
          row += '?'; // Error character
        } else {
          row += '•'; // Ungenerated area
        }
      }
      asciiMap += row + '\n';
    }

    // Add a footer with statistics
    asciiMap += `\nExisting tiles: ${existingTileCount}/${width * height} (${(
      (existingTileCount / (width * height)) *
      100
    ).toFixed(1)}%)\n`;

    this.logger.log(
      `Rendered ASCII map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates`,
    );
    return asciiMap;
  }
  public async prepareMapData(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<{
    width: number;
    height: number;
    existingTileCount: number;
    tileData: Array<{
      x: number;
      y: number;
      tile: Partial<WorldTile> | null;
      biome: (typeof BIOMES)[keyof typeof BIOMES] | null;
      hasError: boolean;
    }>;
  }> {
    const width = maxX - minX;
    const height = maxY - minY;

    const tileMap = new Map<string, ComputedTile>();
    // Compute-on-the-fly path: only fetch descriptions for tiles that have them
    const seed = this.worldService.getCurrentSeed();
    const { heightConfig, moistureConfig } = buildGridConfigs();
    const gridGenerator = new GridMapGenerator(
      heightConfig,
      moistureConfig,
      DEFAULT_BIOMES,
      seed,
    );

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const key = `${x},${y}`;

        // Compute tile deterministically
        const sample = gridGenerator.sampleTile(x, y);
        const biomeInfo = mapGridBiomeToBiomeInfo(sample.biome);
        const temperature = deriveTemperature(
          sample.rawHeight,
          sample.rawMoisture,
          y,
        );
        // Create a transient WorldTile-like shape (biome relation omitted; we’ll resolve via BIOMES)
        const tileRecord: ComputedTile = {
          x,
          y,
          biomeId: biomeInfo.id,
          biomeName: biomeInfo.name,
          description: null,
          height: sample.height,
          temperature,
          moisture: sample.moisture,
          seed,
          chunkX: Math.floor(x / 50),
          chunkY: Math.floor(y / 50),
          createdAt: new Date(0),
          updatedAt: new Date(0),
        };

        tileMap.set(key, tileRecord);
      }
    }

    const tileData: Array<{
      x: number;
      y: number;
      tile: Partial<WorldTile> | null;
      biome: (typeof BIOMES)[keyof typeof BIOMES] | null;
      hasError: boolean;
    }> = [];
    let existingTileCount = 0;

    // Collect all tile data using the tileMap
    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        let tile: Partial<WorldTile> | null = null;
        let hasError = false;

        try {
          const dbTile = tileMap.get(`${x},${y}`);
          if (dbTile) {
            tile = {
              x: dbTile.x,
              y: dbTile.y,
              biomeId: dbTile.biomeId,
              biomeName: dbTile.biomeName,
              description: dbTile.description,
              height: dbTile.height,
              temperature: dbTile.temperature,
              moisture: dbTile.moisture,
              seed: dbTile.seed,
              chunkX: dbTile.chunkX,
              chunkY: dbTile.chunkY,
            };
            existingTileCount++;
          }
        } catch (error) {
          this.logger.debug(`Failed to load tile at ${x},${y}:`, error);
          hasError = true;
        }

        const biome =
          tile && tile.biomeName
            ? Object.values(BIOMES).find(
                (b) => b.name.toLowerCase() === tile.biomeName!.toLowerCase(),
              ) || BIOMES.GRASSLAND
            : null;

        tileData.push({
          x,
          y,
          tile,
          biome,
          hasError,
        });
      }
    }

    return {
      width,
      height,
      existingTileCount,
      tileData,
    };
  }
}
