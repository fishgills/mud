/**
 * Sprite Service - Handles loading and drawing biome sprites from tileset
 *
 * The tileset is a horizontal strip of 16x16 tiles indexed by BiomeId.
 * This service provides methods to draw sprites onto a pureimage canvas.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as pureimage from 'pureimage';
import * as fs from 'fs';
import * as path from 'path';
import { PassThrough } from 'stream';
import { BiomeId } from '@mud/constants';
import type { RenderBitmap } from '../image-utils';

export const SPRITE_TILE_SIZE = 16;

type TilesetBitmap = pureimage.Bitmap;

@Injectable()
export class SpriteService implements OnModuleInit {
  private readonly logger = new Logger(SpriteService.name);
  private tileset: TilesetBitmap | null = null;

  async onModuleInit(): Promise<void> {
    await this.loadTileset();
  }

  private getTilesetPath(): string | null {
    // Try multiple locations for the tileset
    const candidates = [
      // Production/build location (dist folder)
      path.join(__dirname, 'tileset.png'),
      // Development location (source folder) - when running with nest start --watch
      path.resolve(__dirname, '../../../../src/render/sprites/tileset.png'),
      // Alternative dev location
      path.resolve(process.cwd(), 'src/render/sprites/tileset.png'),
      // Dist location when cwd is apps/world
      path.resolve(process.cwd(), 'dist/render/sprites/tileset.png'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        this.logger.debug(`Found tileset at: ${candidate}`);
        return candidate;
      }
      this.logger.debug(`Tileset not found at: ${candidate}`);
    }

    return null;
  }

  private async loadTileset(): Promise<void> {
    try {
      const tilesetPath = this.getTilesetPath();
      if (!tilesetPath) {
        this.logger.warn(
          `Tileset not found in any expected location. Run 'node --import tsx src/render/sprites/generate-tileset.ts' to generate.`,
        );
        return;
      }

      const buffer = fs.readFileSync(tilesetPath);
      const stream = new PassThrough();
      stream.end(buffer);
      this.tileset = await pureimage.decodePNGFromStream(stream);
      this.logger.log(
        `Loaded tileset from ${tilesetPath}: ${this.tileset.width}x${this.tileset.height} pixels`,
      );
    } catch (error) {
      this.logger.error(`Failed to load tileset: ${error}`);
    }
  }

  /**
   * Check if sprites are available for rendering
   */
  isReady(): boolean {
    return this.tileset !== null;
  }

  /**
   * Draw a biome sprite onto a canvas at the specified position
   *
   * @param ctx - The pureimage canvas context
   * @param pixelX - X position on canvas in pixels
   * @param pixelY - Y position on canvas in pixels
   * @param scale - Scale factor (target tile size / 16)
   * @param biomeId - The BiomeId to draw
   */
  drawSprite(
    ctx: ReturnType<RenderBitmap['getContext']>,
    pixelX: number,
    pixelY: number,
    scale: number,
    biomeId: BiomeId,
  ): void {
    if (!this.tileset) {
      // Fallback to solid color if tileset not loaded
      ctx.fillStyle = '#333333';
      ctx.fillRect(
        pixelX,
        pixelY,
        SPRITE_TILE_SIZE * scale,
        SPRITE_TILE_SIZE * scale,
      );
      return;
    }

    const srcX = biomeId * SPRITE_TILE_SIZE;
    const srcY = 0;
    const tileSize = SPRITE_TILE_SIZE;
    const destSize = Math.round(tileSize * scale);

    // Use drawImage to copy sprite from tileset to destination
    // pureimage's drawImage: (src, sx, sy, sw, sh, dx, dy, dw, dh)
    ctx.drawImage(
      this.tileset,
      srcX,
      srcY,
      tileSize,
      tileSize,
      pixelX,
      pixelY,
      destSize,
      destSize,
    );
  }

  /**
   * Draw a biome sprite with optional variation based on world coordinates
   * This can add slight color/brightness variations for less repetitive appearance
   *
   * @param ctx - The pureimage canvas context
   * @param pixelX - X position on canvas in pixels
   * @param pixelY - Y position on canvas in pixels
   * @param scale - Scale factor (target tile size / 16)
   * @param biomeId - The BiomeId to draw
   * @param worldX - World X coordinate for variation seeding
   * @param worldY - World Y coordinate for variation seeding
   */
  drawSpriteWithVariation(
    ctx: ReturnType<RenderBitmap['getContext']>,
    pixelX: number,
    pixelY: number,
    scale: number,
    biomeId: BiomeId,
    worldX: number,
    worldY: number,
  ): void {
    // First draw the base sprite
    this.drawSprite(ctx, pixelX, pixelY, scale, biomeId);

    // Apply subtle variation overlay based on position
    const destSize = Math.round(SPRITE_TILE_SIZE * scale);
    const hash = this.hash32(worldX, worldY, biomeId);
    const variation = (hash % 15) - 7; // -7 to +7 brightness variation

    if (Math.abs(variation) > 2) {
      const alpha = Math.abs(variation) / 50; // Very subtle: 0.04 to 0.14
      ctx.fillStyle =
        variation > 0 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
      ctx.fillRect(pixelX, pixelY, destSize, destSize);
    }
  }

  /**
   * Simple hash function for deterministic variation
   */
  private hash32(x: number, y: number, seed: number): number {
    let h = seed ^ 0xdeadbeef;
    h = Math.imul(h ^ x, 0x85ebca6b);
    h = Math.imul(h ^ y, 0xc2b2ae35);
    h ^= h >>> 16;
    return h >>> 0;
  }

  /**
   * Get the native tile size of the sprites
   */
  getTileSize(): number {
    return SPRITE_TILE_SIZE;
  }
}
