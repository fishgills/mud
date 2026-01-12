import { Injectable, Logger } from '@nestjs/common';
import { createRenderBitmap, RenderBitmap } from './image-utils';
import { BIOMES } from '../constants';
import { WorldService } from '../world/world-refactored.service';
import { GridMapGenerator } from '../gridmap/gridmap-generator';
import { DEFAULT_BIOMES } from '../gridmap/default-biomes';
import { buildGridConfigs, deriveTemperature } from '../gridmap/utils';
import { mapGridBiomeToBiomeInfo } from '../gridmap/biome-mapper';
import { WorldTile } from 'src/world/dto';
import { SpriteService } from './sprites/sprite.service';

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
  private readonly RENDER_STYLE_VERSION = 8; // v8: top-down orthogonal with sprite autotiling

  constructor(
    private readonly worldService: WorldService,
    private readonly spriteService: SpriteService,
  ) {}

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
    return this.renderMapTopDown(minX, maxX, minY, maxY, pixelsPerTile);
  }

  private async renderMapTopDown(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    pixelsPerTile = 4,
  ): Promise<RenderBitmap> {
    const p = Math.max(1, Math.floor(pixelsPerTile));
    this.logger.debug(
      `Top-down render: bounds=(${minX},${minY})-(${maxX - 1},${
        maxY - 1
      }), p=${p}`,
    );

    const { width, height, tileData, existingTileCount } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    if (width <= 0 || height <= 0) {
      this.logger.warn('Empty map region, returning empty canvas');
      return createRenderBitmap(0, 0);
    }

    // Simple orthogonal canvas size
    const canvasWidth = width * p;
    const canvasHeight = height * p;

    const canvas = createRenderBitmap(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Build biome map for neighbor lookups
    const biomeMap = new Map<string, number>();
    for (const { x, y, tile } of tileData) {
      if (tile && tile.biomeId) {
        biomeMap.set(`${x},${y}`, tile.biomeId);
      }
    }

    // Render tiles using sprite service
    for (const { x, y, tile, biome } of tileData) {
      if (!tile || !biome) continue;

      const pixelX = (x - minX) * p;
      // Flip Y-axis so north is up, south is down
      const pixelY = (maxY - y - 1) * p;

      if (this.spriteService.isReady()) {
        // Use autotiled sprites
        this.spriteService.drawAutoTile(
          ctx,
          x,
          y,
          pixelX,
          pixelY,
          p,
          biome.id as number,
          biomeMap,
        );
      } else {
        // Fallback: draw solid color if sprites not loaded
        ctx.fillStyle = biome.color;
        ctx.fillRect(pixelX, pixelY, p, p);

        // Add subtle variation for texture
        const hash = this.hash32(x, y, biome.id as number);
        const variation = (hash % 10) - 5;
        if (variation !== 0 && p >= 4) {
          const alpha = Math.abs(variation) / 80;
          ctx.fillStyle =
            variation > 0
              ? `rgba(255,255,255,${alpha})`
              : `rgba(0,0,0,${alpha})`;
          ctx.fillRect(pixelX, pixelY, p, p);
        }
      }
    }

    // Player position marker - bright and prominent
    const centerTileX = minX + Math.floor((maxX - minX) / 2);
    const centerTileY = minY + Math.floor((maxY - minY) / 2);
    const cpx = (centerTileX - minX) * p + p / 2;
    // Flip Y-axis for marker to match tile rendering
    const cpy = (maxY - centerTileY - 1) * p + p / 2;
    const markerSize = Math.max(6, Math.floor(p * 0.8));

    // Draw outer glow/shadow for visibility
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(cpx, cpy, markerSize + 2, 0, Math.PI * 2);
    ctx.fill();

    // Draw bright circular marker
    ctx.fillStyle = '#ffff00'; // Bright yellow
    ctx.beginPath();
    ctx.arc(cpx, cpy, markerSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw white border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, Math.floor(p / 8));
    ctx.beginPath();
    ctx.arc(cpx, cpy, markerSize, 0, Math.PI * 2);
    ctx.stroke();

    // Draw crosshair inside
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, Math.floor(p / 12));
    ctx.beginPath();
    const crossSize = Math.floor(markerSize * 0.5);
    ctx.moveTo(cpx - crossSize, cpy);
    ctx.lineTo(cpx + crossSize, cpy);
    ctx.moveTo(cpx, cpy - crossSize);
    ctx.lineTo(cpx, cpy + crossSize);
    ctx.stroke();

    this.logger.log(
      `[ortho] Rendered map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates (${canvasWidth}×${canvasHeight} pixels)`,
    );

    return canvas;
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
}
