import { Body, Controller, Post } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { LootService } from '../../monster/loot.service';

@Controller('loot')
export class LootController {
  constructor(
    private readonly playerService: PlayerService,
    private readonly lootService: LootService,
  ) {}

  @Post('spawn')
  async spawnLootAtPlayer(
    @Body()
    payload: {
      teamId?: string;
      userId?: string;
    },
  ) {
    const { teamId, userId } = payload ?? {};
    if (!teamId || !userId) {
      return { success: false, message: 'teamId and userId are required' };
    }

    try {
      const player = await this.playerService.getPlayer(teamId, userId, {
        requireCreationComplete: true,
      });
      if (
        player.x === null ||
        player.y === null ||
        typeof player.x !== 'number' ||
        typeof player.y !== 'number'
      ) {
        return {
          success: false,
          message: 'Player location is unknown; cannot spawn loot.',
        };
      }

      const drops = await this.lootService.spawnLootForPlayer(player);
      return {
        success: true,
        data: {
          drops,
          location: { x: player.x, y: player.y },
        },
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to spawn loot',
      };
    }
  }
}
