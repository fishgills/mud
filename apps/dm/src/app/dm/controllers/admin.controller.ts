import {
  Controller,
  Post,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { MonsterService } from '../../monster/monster.service';
import { WorldService } from '../../world/world.service';

@Controller('dm')
export class AdminController {
  constructor(
    private monsterService: MonsterService,
    private worldService: WorldService,
  ) {}

  // Admin endpoints
  @Post('admin/spawn-monster/:x/:y')
  async spawnMonster(@Param('x') x: string, @Param('y') y: string) {
    try {
      const xCoord = parseInt(x);
      const yCoord = parseInt(y);

      // Get biome info from world service
      const tileInfo = await this.worldService.getTileInfo(xCoord, yCoord);
      const monster = await this.monsterService.spawnMonster(
        xCoord,
        yCoord,
        tileInfo.biomeId,
      );

      return {
        success: true,
        data: monster,
        message: `Spawned ${monster.name} at (${xCoord}, ${yCoord})`,
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to spawn monster',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
