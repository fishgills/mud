import { Controller, Get, Param } from '@nestjs/common';
import { WorldService } from './world-refactored.service';

@Controller()
export class WorldController {
  constructor(private worldService: WorldService) {}

  @Get('health')
  health() {
    return { status: 'healthy', timestamp: new Date().toISOString() };
  }

  @Get('chunk/:chunkX/:chunkY')
  async getChunk(
    @Param('chunkX') chunkX: string,
    @Param('chunkY') chunkY: string,
  ) {
    const chunk = await this.worldService.getChunk(
      parseInt(chunkX),
      parseInt(chunkY),
    );
    return chunk;
  }

  @Get('tile/:x/:y')
  async getTile(@Param('x') x: string, @Param('y') y: string) {
    const tile = await this.worldService.getTileWithNearbyBiomes(
      parseInt(x),
      parseInt(y),
    );
    return tile;
  }
}
