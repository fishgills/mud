import { Injectable, Logger } from '@nestjs/common';
import { createCanvas } from 'canvas';
import { PrismaService } from '../prisma/prisma.service';
import { BIOMES } from '../constants';
import { WorldService } from '../world/world-refactored.service';
import { Settlement, WorldTile } from '@mud/database';

@Injectable()
export class RenderService {
  private readonly logger = new Logger(RenderService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly worldService: WorldService,
  ) {}

  async renderMap(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    pixelsPerTile = 4,
  ) {
    const { width, height, existingTileCount, tileData } =
      await this.prepareMapData(minX, maxX, minY, maxY);

    const p = Math.max(1, Math.floor(pixelsPerTile));
    const canvas = createCanvas(width * p, height * p); // pixels per tile
    const ctx = canvas.getContext('2d');

    // Background - use a neutral color to show ungenerated areas
    ctx.fillStyle = '#2c2c2c'; // Dark gray for ungenerated areas
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Precompute center tile coordinates of the region
    const centerTileX = Math.floor((minX + maxX - 1) / 2);
    const centerTileY = Math.floor((minY + maxY - 1) / 2);

    // Render each tile
    for (const { x, y, tile, settlement, biome } of tileData) {
      const pixelX = (x - minX) * p;
      const pixelY = (y - minY) * p;

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

      // Draw a small 'X' marker on the exact center tile of the map
      if (x === centerTileX && y === centerTileY) {
        // Choose a contrasting color; white stands out on most biomes
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < p; i++) {
          // Primary diagonal
          ctx.fillRect(pixelX + i, pixelY + i, 1, 1);
          // Secondary diagonal
          ctx.fillRect(pixelX + (p - 1 - i), pixelY + i, 1, 1);
        }
        // Thicken lines for higher resolutions
        if (p >= 6) {
          ctx.fillStyle = '#000000';
          for (let i = 0; i < p; i++) {
            ctx.fillRect(pixelX + i, pixelY + i + 1, 1, 1);
            ctx.fillRect(pixelX + (p - 1 - i), pixelY + i + 1, 1, 1);
          }
        }
      }
    }

    this.logger.log(
      `Rendered map with ${existingTileCount} existing tiles out of ${
        width * height
      } total coordinates`,
    );
    return canvas;
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

    // Fetch all settlements in the region
    const settlements =
      (await this.prisma.settlement.findMany({
        where: {
          x: { gte: minX, lt: maxX },
          y: { gte: minY, lt: maxY },
        },
      })) || [];
    const settlementMap = new Map(settlements.map((s) => [`${s.x},${s.y}`, s]));

    // Fetch all tiles in the region in one DB call
    const tiles = await this.prisma.worldTile.findMany({
      where: {
        x: { gte: minX, lt: maxX },
        y: { gte: minY, lt: maxY },
      },
      include: { biome: true },
    });
    const tileMap = new Map(tiles.map((t) => [`${t.x},${t.y}`, t]));

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
        if (!settlement && settlements.length > 0) {
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
