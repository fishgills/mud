import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, ImageSource, loadImage } from 'canvas';
import { drawBiomeTile, drawBiomeEdges } from './graphics';
import { PrismaService } from '../prisma/prisma.service';
import { BIOMES } from '../constants';
import { WorldService } from '../world/world-refactored.service';
import { Settlement } from '@mud/database';
import { CacheService } from '../shared/cache.service';
import { GridMapGenerator } from '../gridmap/gridmap-generator';
import { DEFAULT_BIOMES } from '../gridmap/default-biomes';
import { buildGridConfigs, deriveTemperature } from '../gridmap/utils';
import { mapGridBiomeToBiomeInfo } from '../gridmap/biome-mapper';
import { WORLD_CHUNK_SIZE } from '@mud/constants';
import { WorldTile } from 'src/world/dto';

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
  private readonly RENDER_STYLE_VERSION = 2; // bump to invalidate cached chunk PNGs when style changes
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldService: WorldService,
    private readonly cache: CacheService,
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
    canvas: ReturnType<typeof createCanvas>;
    width: number;
    height: number;
    existingTileCount: number;
  }> {
    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY, {
        compute: true,
        includeDescriptions: false,
        includeSettlements: true,
      });

    const canvas = createCanvas(width * p, height * p);
    const ctx = canvas.getContext('2d');
    // Background
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center marker location (tile space)
    const centerTileX = minX + Math.floor((maxX - minX) / 2);
    const centerTileY = minY + Math.floor((maxY - minY) / 2);

    // Biome map for edges
    const biomeMap = new Map<
      string,
      (typeof BIOMES)[keyof typeof BIOMES] | null
    >();
    for (const t of tileData) biomeMap.set(`${t.x},${t.y}`, t.biome);

    // Deterministic seed for texturing
    const seed = this.worldService.getCurrentSeed();

    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - minX) * p;
      const pixelY = (maxY - 1 - y) * p; // invert Y

      if (tile && biome) {
        drawBiomeTile(ctx, pixelX, pixelY, p, biome, x, y, seed);
        drawBiomeEdges(
          ctx,
          pixelX,
          pixelY,
          p,
          biome,
          biomeMap.get(`${x},${y + 1}`) || null,
          biomeMap.get(`${x},${y - 1}`) || null,
          biomeMap.get(`${x + 1},${y}`) || null,
          biomeMap.get(`${x - 1},${y}`) || null,
        );
      }

      if (settlement) {
        const isCenter = settlement.x === x && settlement.y === y;
        if (isCenter) {
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(pixelX, pixelY, p, p);
        } else {
          const settlementCheck = this.worldService.isCoordinateInSettlement(
            x,
            y,
            [settlement],
          );
          if (settlementCheck.isSettlement) {
            const intensity = settlementCheck.intensity;
            ctx.fillStyle = `rgba(255, 51, 51, ${intensity * 0.8})`;
            ctx.fillRect(pixelX, pixelY, p, p);
          } else {
            ctx.fillStyle = '#ff3333';
            const dotSize = Math.max(1, Math.floor(p / 2));
            const offset = Math.max(0, Math.floor((p - dotSize) / 2));
            ctx.fillRect(pixelX + offset, pixelY + offset, dotSize, dotSize);
          }
        }
      }

      if (opts.includeCenterMarker && x === centerTileX && y === centerTileY) {
        const lw = Math.max(1, Math.floor(p / 4));
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeRect(pixelX + 0.5, pixelY + 0.5, p - 1, p - 1);
      }
    }

    return { canvas, width, height, existingTileCount };
  }

  // draw helpers are imported from './graphics'

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
    const base64 = canvas.toBuffer('image/png').toString('base64');
    const encodeMs = Date.now() - tEncodeStart;
    // Cache with same TTL as region cache
    const ttlMs = Number(process.env.WORLD_RENDER_CACHE_TTL_MS ?? 30000);
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
    const canvas = createCanvas(width * p, height * p);
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
    const decoded: Array<{ cx: number; cy: number; img: ImageSource } | null> =
      await Promise.all(
        needed.map((n) =>
          n
            ? loadImage(Buffer.from(n.imgB64, 'base64')).then((img) => ({
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
    const lw = Math.max(1, Math.floor(p / 4));
    ctx.lineWidth = lw;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(centerPixelX + 0.5, centerPixelY + 0.5, p - 1, p - 1);

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
    asciiMap += `        ★ Settlement Center, ▓ Dense Settlement, ░ Sparse Settlement, • Ungenerated area\n\n`;

    // Render each row
    for (let y = minY; y < maxY; y++) {
      let row = '';
      for (let x = minX; x < maxX; x++) {
        const tileInfo = tileData.find((t) => t.x === x && t.y === y);
        if (!tileInfo) continue;

        const { settlement, tile, biome, hasError } = tileInfo;

        if (settlement) {
          // Check if this is exactly the settlement center or part of footprint
          const isCenter = settlement.x === x && settlement.y === y;
          if (isCenter) {
            row += '★'; // Settlement center marker
          } else {
            // Get settlement intensity for this tile
            const settlementCheck = this.worldService.isCoordinateInSettlement(
              x,
              y,
              [settlement],
            );
            if (settlementCheck.isSettlement) {
              const intensity = settlementCheck.intensity;
              if (intensity > 0.7) {
                row += '▓'; // Dense settlement
              } else if (intensity > 0.3) {
                row += '▒'; // Medium settlement
              } else {
                row += '░'; // Sparse settlement
              }
            } else {
              row += '*'; // Fallback settlement marker
            }
          }
        } else if (tile && biome) {
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
    options?: {
      compute?: boolean; // force compute mode regardless of env
      includeDescriptions?: boolean; // when computing, fetch described tiles in bounds
      includeSettlements?: boolean; // fetch settlements in bounds
    },
  ): Promise<{
    width: number;
    height: number;
    settlementMap: Map<string, Settlement>;
    existingTileCount: number;
    tileData: Array<{
      x: number;
      y: number;
      tile: Partial<WorldTile> | null;
      settlement: Settlement | undefined;
      biome: (typeof BIOMES)[keyof typeof BIOMES] | null;
      hasError: boolean;
    }>;
  }> {
    const width = maxX - minX;
    const height = maxY - minY;

    const includeSettlements = options?.includeSettlements ?? true;
    // Fetch settlements in the region (optional)
    const settlements = includeSettlements
      ? (await this.prisma.settlement.findMany({
          where: {
            x: { gte: minX, lt: maxX },
            y: { gte: minY, lt: maxY },
          },
        })) || []
      : [];
    const settlementMap = new Map(settlements.map((s) => [`${s.x},${s.y}`, s]));

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
      settlement: Settlement | undefined;
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

        const settlement = settlementMap.get(`${x},${y}`);

        // Check if this coordinate is within any settlement footprint
        let settlementFromFootprint: Settlement | undefined;
        if (includeSettlements && !settlement && settlements.length > 0) {
          const settlementCheck = this.worldService.isCoordinateInSettlement(
            x,
            y,
            settlements,
          );
          if (settlementCheck.isSettlement) {
            settlementFromFootprint = settlementCheck.settlement;
          }
        }

        const finalSettlement = settlement || settlementFromFootprint;

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
          settlement: finalSettlement,
          biome,
          hasError,
        });
      }
    }

    return {
      width,
      height,
      settlementMap,
      existingTileCount,
      tileData,
    };
  }
}
