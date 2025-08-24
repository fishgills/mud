import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, loadImage, CanvasRenderingContext2D } from 'canvas';
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

    // Build quick biome map for edge detection
    const biomeMap = new Map<
      string,
      (typeof BIOMES)[keyof typeof BIOMES] | null
    >();
    for (const t of tileData) {
      biomeMap.set(`${t.x},${t.y}`, t.biome);
    }

    // Render each tile
    const seed = this.worldService.getCurrentSeed();
    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - minX) * p;
      // Invert Y so that higher world Y (north) appears toward the top of the image
      const pixelY = (maxY - 1 - y) * p;

      if (tile && biome) {
        this.drawBiomeTile(ctx, pixelX, pixelY, p, biome, x, y, seed);
        this.drawBiomeEdges(
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
            // Create a semi-transparent red overlay based on intensity (shade full tile for blob effect)
            ctx.fillStyle = `rgba(255, 51, 51, ${intensity * 0.8})`;
            ctx.fillRect(pixelX, pixelY, p, p);
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

  // ----- Visual helpers: deterministic noise + color utils -----
  private hash32(x: number, y: number, seed: number, salt = 0): number {
    // Robert Jenkins' 32 bit integer hash adapted
    let a = (x | 0) ^ 0x9e3779b9;
    let b = (y | 0) ^ 0x85ebca6b;
    let c = (seed | 0) ^ 0xc2b2ae35 ^ (salt | 0);
    a -= b;
    a -= c;
    a ^= c >>> 13;
    b -= c;
    b -= a;
    b ^= a << 8;
    c -= a;
    c -= b;
    c ^= b >>> 13;
    a -= b;
    a -= c;
    a ^= c >>> 12;
    b -= c;
    b -= a;
    b ^= a << 16;
    c -= a;
    c -= b;
    c ^= b >>> 5;
    a -= b;
    a -= c;
    a ^= c >>> 3;
    b -= c;
    b -= a;
    b ^= a << 10;
    c -= a;
    c -= b;
    c ^= b >>> 15;
    return (c >>> 0) & 0xffffffff;
  }

  private rand01(x: number, y: number, seed: number, salt = 0): number {
    return (this.hash32(x, y, seed, salt) % 1000000) / 1000000; // [0,1)
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const h = hex.startsWith('#') ? hex.slice(1) : hex;
    const v =
      h.length === 3
        ? h
            .split('')
            .map((c) => c + c)
            .join('')
        : h;
    const num = parseInt(v, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  }

  private rgbToHex(c: { r: number; g: number; b: number }): string {
    const to = (n: number) =>
      Math.max(0, Math.min(255, Math.round(n)))
        .toString(16)
        .padStart(2, '0');
    return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  }

  private lightenDarken(hex: string, amount: number): string {
    // amount in [-1,1]; positive -> lighten
    const c = this.hexToRgb(hex);
    const delta = Math.max(-1, Math.min(1, amount)) * 255;
    return this.rgbToHex({ r: c.r + delta, g: c.g + delta, b: c.b + delta });
  }

  private mix(hexA: string, hexB: string, t: number): string {
    const a = this.hexToRgb(hexA);
    const b = this.hexToRgb(hexB);
    const m = (u: number, v: number) => u + (v - u) * t;
    return this.rgbToHex({
      r: m(a.r, b.r),
      g: m(a.g, b.g),
      b: m(a.b, b.b),
    } as any);
  }

  private drawBiomeTile(
    ctx: CanvasRenderingContext2D,
    pixelX: number,
    pixelY: number,
    p: number,
    biome: (typeof BIOMES)[keyof typeof BIOMES],
    worldX: number,
    worldY: number,
    seed: number,
  ) {
    // Base fill
    ctx.fillStyle = biome.color;
    ctx.fillRect(pixelX, pixelY, p, p);

    // Sub-tile texturing parameters
    const name = biome.name.toUpperCase();
    const nInit = Math.max(2, Math.min(4, Math.floor(p / 2)));
    const cell = Math.max(1, Math.floor(p / nInit));
    const nEff = Math.max(1, Math.min(nInit, Math.floor(p / cell)));
    const padX = Math.max(0, Math.floor((p - cell * nEff) / 2));
    const padY = Math.max(0, Math.floor((p - cell * nEff) / 2));

    const base = biome.color;

    // Choose style parameters
    let amp = 0.08; // default amplitude for shading
    let altColor: string | null = null;
    let bandFreq = 0; // 0 means disable banding
    if (name.includes('OCEAN') || name === 'LAKE' || name === 'RIVER') {
      amp = 0.1;
      altColor = this.lightenDarken(base, 0.08);
      bandFreq = 1.8;
    } else if (name === 'DESERT') {
      amp = 0.12;
      altColor = this.lightenDarken(base, 0.12);
      bandFreq = 1.6;
    } else if (name === 'BEACH') {
      amp = 0.08;
      altColor = this.lightenDarken(base, 0.1);
      bandFreq = 1.2;
    } else if (name === 'SAVANNA') {
      amp = 0.06;
      altColor = this.lightenDarken(base, 0.06);
    } else if (name === 'FOREST' || name === 'TAIGA' || name === 'JUNGLE') {
      amp = 0.12;
      altColor = this.lightenDarken(base, -0.12); // darker flecks
    } else if (name === 'SWAMP') {
      amp = 0.1;
      altColor = this.lightenDarken(base, -0.1);
    } else if (name === 'MOUNTAIN' || name === 'HILLS' || name === 'ALPINE') {
      amp = 0.14;
      altColor = this.lightenDarken(base, -0.1);
    } else if (
      name === 'SNOWY MOUNTAIN' ||
      name === 'SNOWY_MOUNTAIN' ||
      name === 'TUNDRA'
    ) {
      amp = 0.08;
      altColor = this.mix(base, '#bcd6ff', 0.15); // cool blue shadow
    } else if (name === 'VOLCANIC') {
      amp = 0.12;
      altColor = this.lightenDarken(base, -0.15);
    } else {
      // Grassland and others
      amp = 0.08;
      altColor = this.lightenDarken(base, 0.06);
    }

    // Light direction pseudo shading to add depth
    const lightDir = 0.25; // bias top-left lighter
    for (let j = 0; j < nEff; j++) {
      for (let i = 0; i < nEff; i++) {
        const nx = worldX * 31 + i;
        const ny = worldY * 17 + j;
        const r = this.rand01(nx, ny, seed, 1337);
        const band = bandFreq
          ? Math.sin(
              (worldX * 0.5 +
                worldY * 0.3 +
                i * 0.4 +
                j * 0.2 +
                seed * 0.0001) *
                bandFreq,
            ) *
              0.5 +
            0.5
          : 0.5;
        // depth bias
        const bias =
          (nEff - 1 - i + (nEff - 1 - j)) / (2 * Math.max(1, nEff - 1));
        let t = r * 0.6 + band * 0.4;
        t = t * (1 - lightDir) + bias * lightDir;

        // Decide shade per biome category
        let color = base;
        if (altColor) {
          const s = (t - 0.5) * 2; // [-1,1]
          const mag = Math.max(-1, Math.min(1, (s * amp) / 0.5));
          color =
            mag >= 0
              ? this.mix(base, altColor, mag)
              : this.lightenDarken(base, mag);
        } else {
          color = this.lightenDarken(base, (t - 0.5) * 2 * amp);
        }
        ctx.fillStyle = color;
        ctx.fillRect(
          pixelX + padX + i * cell,
          pixelY + padY + j * cell,
          cell,
          cell,
        );
      }
    }
  }

  private drawBiomeEdges(
    ctx: CanvasRenderingContext2D,
    pixelX: number,
    pixelY: number,
    p: number,
    biome: (typeof BIOMES)[keyof typeof BIOMES],
    north: (typeof BIOMES)[keyof typeof BIOMES] | null,
    south: (typeof BIOMES)[keyof typeof BIOMES] | null,
    east: (typeof BIOMES)[keyof typeof BIOMES] | null,
    west: (typeof BIOMES)[keyof typeof BIOMES] | null,
  ) {
    const edgeW = Math.max(1, Math.floor(p / 6));
    const dark = this.lightenDarken(biome.color, -0.12);
    const light = this.lightenDarken(biome.color, 0.12);
    // north edge (top)
    if (north && north.name !== biome.name) {
      ctx.fillStyle = dark;
      ctx.fillRect(pixelX, pixelY, p, edgeW);
    }
    // south edge (bottom)
    if (south && south.name !== biome.name) {
      ctx.fillStyle = dark;
      ctx.fillRect(pixelX, pixelY + p - edgeW, p, edgeW);
    }
    // east edge (right)
    if (east && east.name !== biome.name) {
      ctx.fillStyle = light;
      ctx.fillRect(pixelX + p - edgeW, pixelY, edgeW, p);
    }
    // west edge (left)
    if (west && west.name !== biome.name) {
      ctx.fillStyle = light;
      ctx.fillRect(pixelX, pixelY, edgeW, p);
    }
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
    // Build biome map for this chunk
    const biomeMap = new Map<
      string,
      (typeof BIOMES)[keyof typeof BIOMES] | null
    >();
    for (const t of tileData) {
      biomeMap.set(`${t.x},${t.y}`, t.biome);
    }

    // Paint tiles and settlement overlays (no center marker here!)
    const seed = this.worldService.getCurrentSeed();
    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - startX) * p;
      const pixelY = (endY - 1 - y) * p;
      if (tile && biome) {
        this.drawBiomeTile(ctx, pixelX, pixelY, p, biome, x, y, seed);
        this.drawBiomeEdges(
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
