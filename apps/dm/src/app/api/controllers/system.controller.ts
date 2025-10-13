import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { MonsterService } from '../../monster/monster.service';
import { GameTickService } from '../../game-tick/game-tick.service';
import { PlayerService } from '../../player/player.service';
import type { Monster } from '../dto/monster.dto';
import type {
  GameStateResponse,
  MonsterResponse,
  TickSuccessResponse,
  GameState,
  HealthCheck,
} from '../dto/responses.dto';
import type { SpawnMonsterRequest } from '../dto/player-requests.dto';
import { EntityToDtoAdapter } from '../adapters/entity-to-dto.adapter';

@Controller('system')
export class SystemController {
  constructor(
    private readonly monsterService: MonsterService,
    private readonly gameTickService: GameTickService,
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
      throw new BadRequestException('minutesThreshold must be a positive number');
    }

    const active = await this.playerService.hasActivePlayers(minutesThreshold);
    return { success: true, active, minutesThreshold };
  }

  @Post('process-tick')
  async processTick(): Promise<TickSuccessResponse> {
    try {
      const result = await this.gameTickService.processTick();
      return {
        success: true,
        result,
        message: 'Tick processed successfully',
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Tick processing failed',
      };
    }
  }

  @Get('game-state')
  async getGameState(): Promise<GameStateResponse> {
    try {
      await this.gameTickService.getGameState();
      const monsters = await this.monsterService.getAllMonsters();

      const gameState: GameState = {
        currentTime: new Date().toISOString(),
        totalPlayers: 0,
        totalMonsters: monsters.length,
      };

      return {
        success: true,
        data: gameState,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to get game state',
      };
    }
  }

  @Get('monsters')
  async getMonsters(
    @Query('x') rawX?: string,
    @Query('y') rawY?: string,
  ): Promise<Monster[]> {
    if (rawX !== undefined || rawY !== undefined) {
      const x = Number.parseInt(rawX ?? '', 10);
      const y = Number.parseInt(rawY ?? '', 10);
      if (Number.isNaN(x) || Number.isNaN(y)) {
        throw new BadRequestException('x and y must be numeric when provided');
      }
      const monsters = await this.monsterService.getMonstersAtLocation(x, y);
      return EntityToDtoAdapter.monsterEntitiesToDto(monsters);
    }

    const monsters = await this.monsterService.getAllMonsters();
    return EntityToDtoAdapter.monsterEntitiesToDto(monsters);
  }

  @Post('monsters')
  async spawnMonster(
    @Body() input: SpawnMonsterRequest,
  ): Promise<MonsterResponse> {
    if (
      typeof input?.x !== 'number' ||
      Number.isNaN(input.x) ||
      typeof input?.y !== 'number' ||
      Number.isNaN(input.y)
    ) {
      throw new BadRequestException('x and y must be provided as numbers');
    }

    try {
      const monster = await this.monsterService.spawnMonster(
        input.x,
        input.y,
        1,
      );

      return {
        success: true,
        data: EntityToDtoAdapter.monsterEntityToDto(monster),
        message: `Spawned ${monster.name} at (${input.x}, ${input.y})`,
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
