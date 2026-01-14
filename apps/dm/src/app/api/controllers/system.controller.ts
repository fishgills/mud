import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
  Param,
} from '@nestjs/common';
import { MonsterService } from '../../monster/monster.service';
import { PlayerService } from '../../player/player.service';
import type { MonsterResponse, HealthCheck } from '../dto/responses.dto';
import { Monster } from '@mud/database';

@Controller('system')
export class SystemController {
  constructor(
    private readonly monsterService: MonsterService,
    private readonly playerService: PlayerService,
  ) {}

  @Get('health')
  health(): HealthCheck {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('active-players')
  async hasActivePlayers(
    @Query('minutesThreshold') rawMinutesThreshold?: string,
  ): Promise<{ success: boolean; active: boolean; minutesThreshold: number }> {
    const minutesThreshold = rawMinutesThreshold
      ? Number.parseFloat(rawMinutesThreshold)
      : 30;
    if (Number.isNaN(minutesThreshold) || minutesThreshold < 0) {
      throw new BadRequestException(
        'minutesThreshold must be a positive number',
      );
    }

    const active = await this.playerService.hasActivePlayers(minutesThreshold);
    return { success: true, active, minutesThreshold };
  }

  @Post('process-tick')
  async processTick(): Promise<{ success: boolean; message: string }> {
    return {
      success: true,
      message: 'Tick processing disabled',
    };
  }

  @Get('monsters')
  async getMonsters(): Promise<Monster[]> {
    return await this.monsterService.getAllMonsters();
  }

  @Get('monster/:id')
  async getMonsterById(@Param('id') id: string): Promise<Monster | null> {
    const monsterId = Number.parseInt(id, 10);
    if (Number.isNaN(monsterId)) {
      throw new BadRequestException('id must be a numeric value');
    }
    return await this.monsterService.getMonsterById(monsterId);
  }

  @Post('monsters')
  async spawnMonster(
    @Body() input: { type?: string },
  ): Promise<MonsterResponse> {
    try {
      const monster = await this.monsterService.spawnMonster(input?.type);

      return {
        success: true,
        data: monster,
        message: `Spawned ${monster.name}`,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to spawn monster',
      };
    }
  }
}
