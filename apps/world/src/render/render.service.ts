import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, loadImage } from 'canvas';
import { PrismaService } from '../prisma/prisma.service';
import { BIOMES } from '../constants';
import { WorldService } from '../world/world-refactored.service';
import { Settlement, WorldTile } from '@mud/database';
import { CacheService } from '../shared/cache.service';
import { NoiseGenerator } from '../noise-generator/noise-generator';
import { BiomeGenerator } from '../biome-generator/biome-generator';
import { DEFAULT_WORLD_CONFIG, WorldSeedConfig } from '../world/types';
import { env } from '../env';

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
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
    debugOverlay = false,
  ) {
    // Attempt fast path: compose from cached chunk PNGs if all present
    const chunkSize = 50;
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

    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY, {
        compute: true,
        includeDescriptions: false,
        includeSettlements: true,
      });

    const canvas = createCanvas(width * p, height * p); // pixels per tile
    const ctx = canvas.getContext('2d');

    // Background - use a neutral color to show ungenerated areas
    ctx.fillStyle = '#2c2c2c'; // Dark gray for ungenerated areas
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Precompute center tile coordinates of the region
    // Use half-width/height from min to align center with requested (x,y), even for even-sized regions
    const centerTileX = minX + Math.floor((maxX - minX) / 2);
    const centerTileY = minY + Math.floor((maxY - minY) / 2);

    // Render each tile
    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - minX) * p;
      // Invert Y so that higher world Y (north) appears toward the top of the image
      const pixelY = (maxY - 1 - y) * p;

      if (tile && biome) {
        ctx.fillStyle = biome.color;
        ctx.fillRect(pixelX, pixelY, p, p);
      }

      // Overlay settlement if present
      if (settlement) {
        const isCenter = settlement.x === x && settlement.y === y;
        if (isCenter) {
          // Settlement center - bright red
          ctx.fillStyle = '#ff0000';
          ctx.fillRect(pixelX, pixelY, p, p);
        } else {
          // Check settlement intensity for footprint areas
          const settlementCheck = this.worldService.isCoordinateInSettlement(
            x,
            y,
            [settlement],
          );
          if (settlementCheck.isSettlement) {
            const intensity = settlementCheck.intensity;
            // Create a semi-transparent red overlay based on intensity
            ctx.fillStyle = `rgba(255, 51, 51, ${intensity * 0.8})`;
            ctx.fillRect(pixelX, pixelY, 4, 4);
          } else {
            // Fallback - small red dot
            ctx.fillStyle = '#ff3333';
            const dotSize = Math.max(1, Math.floor(p / 2));
            const offset = Math.max(0, Math.floor((p - dotSize) / 2));
            ctx.fillRect(pixelX + offset, pixelY + offset, dotSize, dotSize);
          }
        }
      }

      // Draw a distinct PLAYER marker (white outline) on the exact center tile of the map
      if (x === centerTileX && y === centerTileY) {
        const lw = Math.max(1, Math.floor(p / 4));
        ctx.lineWidth = lw;
        ctx.strokeStyle = '#ffffff';
        // Use 0.5 offset for crisp strokes
        ctx.strokeRect(pixelX + 0.5, pixelY + 0.5, p - 1, p - 1);
      }
    }

    // Debug overlay removed by request

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

  private chunkKey(chunkX: number, chunkY: number, p: number) {
    return `chunk:png:${chunkX},${chunkY},p=${p}`;
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
    const tPrepareStart = Date.now();
    const { width, height, tileData } = await this.prepareMapData(
      startX,
      endX,
      startY,
      endY,
      {
        compute: true,
        includeDescriptions: false,
        includeSettlements: true,
      },
    );
    const prepareMs = Date.now() - tPrepareStart;

    const canvas = createCanvas(width * p, height * p);
    const ctx = canvas.getContext('2d');
    // Background
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const tRenderStart = Date.now();
    // Paint tiles and settlement overlays (no center marker here!)
    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - startX) * p;
      const pixelY = (endY - 1 - y) * p;
      if (tile && biome) {
        ctx.fillStyle = biome.color;
        ctx.fillRect(pixelX, pixelY, p, p);
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
            ctx.fillRect(pixelX, pixelY, 4, 4);
          } else {
            ctx.fillStyle = '#ff3333';
            const dotSize = Math.max(1, Math.floor(p / 2));
            const offset = Math.max(0, Math.floor((p - dotSize) / 2));
            ctx.fillRect(pixelX + offset, pixelY + offset, dotSize, dotSize);
          }
        }
      }
    }
    const renderMs = Date.now() - tRenderStart;

    const tEncodeStart = Date.now();
    const base64 = canvas.toBuffer('image/png').toString('base64');
    const encodeMs = Date.now() - tEncodeStart;
    // Cache with same TTL as region cache
    const ttlMs = Number(process.env.WORLD_RENDER_CACHE_TTL_MS ?? 30000);
    await this.cache.set(key, base64, ttlMs);
    const sizeKB = Math.round(((base64.length / 4) * 3) / 1024);
    this.logger.debug(
      `[chunkpng SET] ${key} ttlMs=${ttlMs} prepareMs=${prepareMs} renderMs=${renderMs} encodeMs=${encodeMs} sizeKB=${sizeKB}`,
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
    const decoded = await Promise.all(
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

      ctx.drawImage(img as any, sx, sy, sw, sh, dx, dy, dw, dh);
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
    const tasks: Promise<any>[] = [];
    for (let cx = minChunkX; cx <= maxChunkX; cx++) {
      for (let cy = minChunkY; cy <= maxChunkY; cy++) {
        tasks.push(
          this.getChunkPngBase64(cx, cy, p).catch((e) => {
            this.logger.debug(
              `[chunkpng PREWARM FAIL] (${cx},${cy},p=${p}): ${
                e?.message ?? e
              }`,
            );
          }),
        );
      }
    }
    const results = await Promise.allSettled(tasks);
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
    const computeMode = options?.compute ?? env.WORLD_RENDER_COMPUTE_ON_THE_FLY;

    let tileMap: Map<string, WorldTile>;
    if (!computeMode) {
      // Legacy DB-backed path: fetch all tiles from DB
      const tiles = await this.prisma.worldTile.findMany({
        where: { x: { gte: minX, lt: maxX }, y: { gte: minY, lt: maxY } },
        include: { biome: true },
      });
      tileMap = new Map(tiles.map((t) => [`${t.x},${t.y}`, t] as const));
    } else {
      // Compute-on-the-fly path: only fetch descriptions for tiles that have them
      const seed = this.worldService.getCurrentSeed();
      const config: WorldSeedConfig = {
        heightSeed: seed,
        temperatureSeed: seed + 1000,
        moistureSeed: seed + 2000,
        ...DEFAULT_WORLD_CONFIG,
      } as WorldSeedConfig;
      const noise = new NoiseGenerator(config);

      // Optionally fetch described tiles in bounds so we can attach descriptions if present
      const includeDescriptions = options?.includeDescriptions ?? true;
      const describedMap: Map<string, WorldTile> = includeDescriptions
        ? new Map(
            (
              await this.prisma.worldTile.findMany({
                where: {
                  x: { gte: minX, lt: maxX },
                  y: { gte: minY, lt: maxY },
                  NOT: { description: null },
                },
                include: { biome: true },
              })
            ).map((t) => [`${t.x},${t.y}`, t]),
          )
        : new Map();

      tileMap = new Map();
      for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
          const key = `${x},${y}` as string;
          const descTile = describedMap.get(key);
          if (descTile) {
            tileMap.set(key, descTile);
            continue;
          }
          // Compute tile deterministically
          const height = noise.generateHeight(x, y);
          const temperature = noise.generateTemperature(x, y);
          const moisture = noise.generateMoisture(x, y);
          const biomeInfo = BiomeGenerator.determineBiome(
            height,
            temperature,
            moisture,
          );
          // Create a transient WorldTile-like shape (biome relation omitted; we’ll resolve via BIOMES)
          tileMap.set(key, {
            id: 0 as any, // not used by renderer
            x,
            y,
            biomeId: biomeInfo.id,
            biomeName: biomeInfo.name,
            description: null,
            height,
            temperature,
            moisture,
            seed,
            chunkX: Math.floor(x / 50),
            chunkY: Math.floor(y / 50),
            createdAt: new Date(0) as any,
            updatedAt: new Date(0) as any,
            // These extra relations/fields from Prisma types are not used in rendering
          } as unknown as WorldTile);
        }
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
