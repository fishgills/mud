import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as pureimage from 'pureimage';
import * as path from 'path';
import type { Context } from 'pureimage';
import { buildNeighborMask, getAutoTileIndex } from './autotile-mapping';

const TILE_SIZE = 16;
const VARIANT_COUNT = 47;
const BIOME_COUNT = 18;

@Injectable()
export class SpriteService implements OnModuleInit {
  private readonly logger = new Logger(SpriteService.name);
  private tileset: pureimage.Bitmap | null = null;
  private ready = false;

  async onModuleInit(): Promise<void> {
    await this.loadTileset();
  }

  /**
   * Load the tileset PNG on service initialization
   */
  private async loadTileset(): Promise<void> {
    try {
      // Try dist path first (where assets are copied during build)
      let tilesetPath = path.join(__dirname, 'tileset.png');

      // If not found in dist, try src directory (development mode)
      if (!require('fs').existsSync(tilesetPath)) {
        // __dirname in dist is: dist/src/render/sprites
        // We need to go up 4 levels to reach project root, then into src
        const srcPath = path.join(
          __dirname,
          '../../../../src/render/sprites/tileset.png',
        );
        if (require('fs').existsSync(srcPath)) {
          tilesetPath = srcPath;
        } else {
          this.logger.error(`Tileset not found. Tried:
  - ${tilesetPath}
  - ${srcPath}

Please ensure tileset.png exists. You can generate it by running:
  npx ts-node src/render/sprites/generate-tileset.ts`);
          throw new Error(`Tileset not found at ${tilesetPath} or ${srcPath}`);
        }
      }

      this.logger.log(`Loading tileset from ${tilesetPath}...`);

      this.tileset = await pureimage.decodePNGFromStream(
        require('fs').createReadStream(tilesetPath),
      );

      const expectedWidth = VARIANT_COUNT * TILE_SIZE;
      const expectedHeight = BIOME_COUNT * TILE_SIZE;

      if (
        this.tileset.width !== expectedWidth ||
        this.tileset.height !== expectedHeight
      ) {
        throw new Error(
          `Tileset dimensions mismatch! Expected ${expectedWidth}×${expectedHeight}, got ${this.tileset.width}×${this.tileset.height}`,
        );
      }

      this.ready = true;
      this.logger.log(
        `✓ Tileset loaded successfully (${this.tileset.width}×${this.tileset.height})`,
      );
    } catch (error) {
      this.logger.error('Failed to load tileset:', error);
      this.ready = false;
      throw error;
    }
  }

  /**
   * Check if the sprite service is ready to render
   */
  isReady(): boolean {
    return this.ready && this.tileset !== null;
  }

  /**
   * Get the native tile size (16×16)
   */
  getTileSize(): number {
    return TILE_SIZE;
  }

  /**
   * Draw an autotiled sprite at the specified position.
   * Automatically selects the correct tile variant based on neighbors.
   *
   * @param ctx - Canvas rendering context
   * @param worldX - World X coordinate of the tile
   * @param worldY - World Y coordinate of the tile
   * @param pixelX - Pixel X position on canvas
   * @param pixelY - Pixel Y position on canvas
   * @param tileSize - Size to render the tile (scaled from 16×16)
   * @param biomeId - Biome ID (1-18)
   * @param biomeMap - Map of "x,y" to biome ID for neighbor lookups
   */
  drawAutoTile(
    ctx: Context,
    worldX: number,
    worldY: number,
    pixelX: number,
    pixelY: number,
    tileSize: number,
    biomeId: number,
    biomeMap: Map<string, number>,
  ): void {
    if (!this.isReady() || !this.tileset) {
      // Fallback: draw solid color if tileset not loaded
      this.logger.warn('Tileset not ready, skipping sprite draw');
      return;
    }

    // Validate biome ID
    if (biomeId < 1 || biomeId > BIOME_COUNT) {
      this.logger.warn(`Invalid biome ID: ${biomeId}, defaulting to 1`);
      biomeId = 1;
    }

    // Calculate neighbor mask and get tile variant
    const neighborMask = buildNeighborMask(worldX, worldY, biomeId, biomeMap);
    const variantIndex = getAutoTileIndex(neighborMask);

    // Calculate source position in tileset
    const srcX = variantIndex * TILE_SIZE;
    const srcY = (biomeId - 1) * TILE_SIZE; // BiomeId is 1-based

    // Draw sprite with scaling
    try {
      // pureimage's drawImage signature:
      // drawImage(image, srcX, srcY, srcW, srcH, dstX, dstY, dstW, dstH)
      ctx.drawImage(
        this.tileset,
        srcX,
        srcY,
        TILE_SIZE,
        TILE_SIZE,
        pixelX,
        pixelY,
        tileSize,
        tileSize,
      );
    } catch (error) {
      this.logger.error(
        `Failed to draw sprite: biome=${biomeId}, variant=${variantIndex}, pos=(${worldX},${worldY})`,
        error,
      );
    }
  }

  /**
   * Draw a sprite variant directly (for testing/debugging).
   *
   * @param ctx - Canvas rendering context
   * @param pixelX - Pixel X position on canvas
   * @param pixelY - Pixel Y position on canvas
   * @param tileSize - Size to render the tile
   * @param biomeId - Biome ID (1-18)
   * @param variantIndex - Tile variant index (0-46)
   */
  drawSprite(
    ctx: Context,
    pixelX: number,
    pixelY: number,
    tileSize: number,
    biomeId: number,
    variantIndex: number,
  ): void {
    if (!this.isReady() || !this.tileset) {
      this.logger.warn('Tileset not ready, skipping sprite draw');
      return;
    }

    if (biomeId < 1 || biomeId > BIOME_COUNT) {
      this.logger.warn(`Invalid biome ID: ${biomeId}`);
      return;
    }

    if (variantIndex < 0 || variantIndex >= VARIANT_COUNT) {
      this.logger.warn(`Invalid variant index: ${variantIndex}`);
      return;
    }

    const srcX = variantIndex * TILE_SIZE;
    const srcY = (biomeId - 1) * TILE_SIZE;

    ctx.drawImage(
      this.tileset,
      srcX,
      srcY,
      TILE_SIZE,
      TILE_SIZE,
      pixelX,
      pixelY,
      tileSize,
      tileSize,
    );
  }
}
