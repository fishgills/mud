import {
  Controller,
  Get,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { CombatService } from '../../combat/combat.service';
import { WorldService } from '../../world/world.service';

@Controller('dm')
export class LocationController {
  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService,
    private combatService: CombatService,
    private worldService: WorldService,
  ) {}

  @Get('location/:x/:y')
  async getLocationInfo(@Param('x') x: string, @Param('y') y: string) {
    try {
      const xCoord = parseInt(x);
      const yCoord = parseInt(y);

      const tileInfo = await this.worldService.getTileInfo(xCoord, yCoord);
      const monsters = await this.monsterService.getMonstersAtLocation(
        xCoord,
        yCoord,
      );
      const players = await this.playerService.getPlayersAtLocation(
        xCoord,
        yCoord,
      );
      const combatLog = await this.combatService.getCombatLogForLocation(
        xCoord,
        yCoord,
      );

      return {
        success: true,
        data: {
          location: tileInfo,
          monsters,
          players,
          recentCombat: combatLog,
        },
      };
    } catch (error) {
      throw new HttpException(
        error instanceof Error ? error.message : 'Failed to get location info',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
