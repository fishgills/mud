import { Args, Query, Resolver, Int } from '@nestjs/graphql';
import { RenderService } from './render.service';
import { Injectable, Logger } from '@nestjs/common';
import { MapTile } from './map-tile.model';

@Resolver()
@Injectable()
export class RenderResolver {
  private logger = new Logger(RenderResolver.name);

  constructor(private readonly renderService: RenderService) {}

  @Query(() => [[MapTile]], {
    description:
      'Returns a 2D array of map tiles for a 50x50 region centered on (x, y).',
  })
  async renderMapTiles(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<MapTile[][]> {
    this.logger.debug(`Rendering map tiles centered at (${x}, ${y})`);
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    // Get tile data from the render service
    const { tileData } = await this.renderService.prepareMapData(
      minX,
      maxX,
      minY,
      maxY,
    );
    // Build a 2D array (rows by y, columns by x)
    const rows: MapTile[][] = [];
    for (let yVal = minY; yVal < maxY; yVal++) {
      const row: MapTile[] = [];
      for (let xVal = minX; xVal < maxX; xVal++) {
        const tileInfo = tileData.find((t) => t.x === xVal && t.y === yVal);
        row.push({
          x: xVal,
          y: yVal,
          biomeName: tileInfo?.biome?.name ?? undefined,
          symbol: tileInfo?.biome?.ascii ?? undefined,
          hasSettlement: !!tileInfo?.settlement,
          isSettlementCenter:
            !!tileInfo?.settlement &&
            tileInfo.settlement.x === xVal &&
            tileInfo.settlement.y === yVal,
        });
      }
      rows.push(row);
    }
    return rows;
  }

  @Query(() => String, {
    description: 'Returns an ASCII map centered on (x, y) with a 50x50 region.',
  })
  async renderMapAscii(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<string> {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    return this.renderService.renderMapAscii(minX, maxX, minY, maxY);
  }

  // Note: Binary image (PNG) is not directly supported in GraphQL, so we return a base64 string
  @Query(() => String, {
    description:
      'Returns a PNG map centered on (x, y) as a base64 string (50x50 region).',
  })
  async renderMapPngBase64(
    @Args('x', { type: () => Int, nullable: true }) x?: number,
    @Args('y', { type: () => Int, nullable: true }) y?: number,
  ): Promise<string> {
    const centerX = x ?? 0;
    const centerY = y ?? 0;
    const half = 25;
    const minX = centerX - half;
    const maxX = centerX + half;
    const minY = centerY - half;
    const maxY = centerY + half;
    const canvas = await this.renderService.renderMap(minX, maxX, minY, maxY);
    return canvas.toBuffer('image/png').toString('base64');
  }
}
