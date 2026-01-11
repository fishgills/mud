import { Injectable, Logger } from '@nestjs/common';
import type { Context } from 'pureimage';
import { createRenderBitmap, RenderBitmap } from './image-utils';
import { BIOMES } from '../constants';
import { WorldService } from '../world/world-refactored.service';
import { GridMapGenerator } from '../gridmap/gridmap-generator';
import { DEFAULT_BIOMES } from '../gridmap/default-biomes';
import { buildGridConfigs, deriveTemperature } from '../gridmap/utils';
import { mapGridBiomeToBiomeInfo } from '../gridmap/biome-mapper';
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
  private readonly RENDER_STYLE_VERSION = 7; // v7: isometric-only rendering

  constructor(private readonly worldService: WorldService) {}

  getRenderStyleVersion(): number {
    return this.RENDER_STYLE_VERSION;
  }

  async renderMap(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    pixelsPerTile = 4,
  ) {
    return this.renderMapIsometric(minX, maxX, minY, maxY, pixelsPerTile);
  }

  async renderMapIsometric(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    pixelsPerTile = 4,
  ) {
    const p = Math.max(1, Math.floor(pixelsPerTile));
    this.logger.debug(
      `Isometric render: bounds=(${minX},${minY})-(${maxX - 1},${
        maxY - 1
      }), p=${p}`,
    );
    const { canvas, width, height, existingTileCount } =
      await this.renderRegionCanvasIsometric(minX, maxX, minY, maxY, p);

    this.logger.log(
      `[iso] Rendered map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates`,
    );
    return canvas;
  }

  private async renderRegionCanvasIsometric(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    p: number,
  ): Promise<{
    canvas: RenderBitmap;
    width: number;
    height: number;
    existingTileCount: number;
  }> {
    const { width, height, tileData, existingTileCount } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    if (width <= 0 || height <= 0) {
      return {
        canvas: createRenderBitmap(0, 0),
        width,
        height,
        existingTileCount,
      };
    }

    // Isometric tile footprint
    const isoW = p * 2; // diamond width
    const isoH = Math.max(1, Math.floor(p * 0.85)); // diamond height

    // Compute canvas size (bounds of diamond lattice)
    const minIsoX = -(height - 1) * (isoW / 2);
    const maxIsoX = (width - 1) * (isoW / 2);
    const minIsoY = 0;
    const maxIsoY = (width + height - 2) * (isoH / 2);

    const canvasWidth = Math.ceil(maxIsoX - minIsoX + isoW);
    const canvasHeight = Math.ceil(maxIsoY - minIsoY + isoH * 2);

    const offsetX = -minIsoX;
    const offsetY = isoH; // padding at top

    const canvas = createRenderBitmap(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const centerTileX = minX + Math.floor((maxX - minX) / 2);
    const centerTileY = minY + Math.floor((maxY - minY) / 2);

    // Sort tiles back-to-front by (x+y) to maintain correct overdraw ordering
    const sorted = [...tileData].sort((a, b) => a.x + a.y - (b.x + b.y));

    for (const { x, y, tile, biome } of sorted) {
      if (!tile || !biome) continue;
      const localX = x - minX;
      const localY = y - minY;
      const sx = (localX - localY) * (isoW / 2) + offsetX;
      const sy = (localX + localY) * (isoH / 2) + offsetY;

      // Base diamond fill
      this.drawIsoDiamond(ctx, sx, sy, isoW, isoH, biome.color);

      // Simple light/shadow for depth
      const highlight = this.lighten(biome.color, 0.12);
      const shadow = this.darken(biome.color, 0.18);
      this.drawIsoDiamondHalf(ctx, sx, sy, isoW, isoH, highlight, 'top');
      this.drawIsoDiamondHalf(ctx, sx, sy, isoW, isoH, shadow, 'bottom');

      // Optional variation overlay for texture: reuse hash for subtle tint
      const hash = this.hash32(localX, localY, biome.id as number);
      const variation = (hash % 10) - 5;
      if (variation !== 0) {
        const alpha = Math.abs(variation) / 80;
        ctx.fillStyle =
          variation > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + isoW / 2, sy + isoH / 2);
        ctx.lineTo(sx, sy + isoH);
        ctx.lineTo(sx - isoW / 2, sy + isoH / 2);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Center marker projected into iso space
    const cLocalX = centerTileX - minX;
    const cLocalY = centerTileY - minY;
    const cpx = (cLocalX - cLocalY) * (isoW / 2) + offsetX;
    const cpy = (cLocalX + cLocalY) * (isoH / 2) + offsetY;
    const markerSize = Math.max(3, Math.floor(isoH / 2));
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, Math.floor(markerSize / 4));
    ctx.beginPath();
    ctx.moveTo(cpx - markerSize, cpy);
    ctx.lineTo(cpx + markerSize, cpy);
    ctx.moveTo(cpx, cpy - markerSize);
    ctx.lineTo(cpx, cpy + markerSize);
    ctx.stroke();

    return { canvas, width, height, existingTileCount };
  }

  private drawIsoDiamond(
    ctx: Context,
    topX: number,
    topY: number,
    w: number,
    h: number,
    color: string,
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(topX + w / 2, topY + h / 2);
    ctx.lineTo(topX, topY + h);
    ctx.lineTo(topX - w / 2, topY + h / 2);
    ctx.closePath();
    ctx.fill();
  }

  private drawIsoDiamondHalf(
    ctx: Context,
    topX: number,
    topY: number,
    w: number,
    h: number,
    color: string,
    half: 'top' | 'bottom',
  ) {
    ctx.fillStyle = color;
    ctx.beginPath();
    if (half === 'top') {
      ctx.moveTo(topX, topY);
      ctx.lineTo(topX + w / 2, topY + h / 2);
      ctx.lineTo(topX, topY + h / 2);
      ctx.lineTo(topX - w / 2, topY + h / 2);
    } else {
      ctx.moveTo(topX - w / 2, topY + h / 2);
      ctx.lineTo(topX, topY + h / 2);
      ctx.lineTo(topX + w / 2, topY + h / 2);
      ctx.lineTo(topX, topY + h);
    }
    ctx.closePath();
    ctx.fill();
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

  private rgbToHex(r: number, g: number, b: number): string {
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
    const to = (n: number) => clamp(n).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
  }

  private lighten(hex: string, amount: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    return this.rgbToHex(
      r + (255 - r) * amount,
      g + (255 - g) * amount,
      b + (255 - b) * amount,
    );
  }

  private darken(hex: string, amount: number): string {
    const { r, g, b } = this.hexToRgb(hex);
    return this.rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
  }

  private hash32(x: number, y: number, seed: number): number {
    let h = seed ^ 0x9e3779b9;
    h = Math.imul(h ^ x, 0x85ebca6b);
    h = Math.imul(h ^ y, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
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
}
