import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { MonsterService } from '../../monster/monster.service';
import { GameTickService } from '../../game-tick/game-tick.service';
import { Monster } from '../models/monster.model';
import {
  HealthCheck,
  GameStateResponse,
  MonsterResponse,
  SuccessResponse,
  GameState,
} from '../types/response.types';
import { SpawnMonsterInput } from '../inputs/player.input';

@Resolver()
export class SystemResolver {
  constructor(
    private monsterService: MonsterService,
    private gameTickService: GameTickService,
  ) {}

  @Query(() => HealthCheck)
  async health(): Promise<HealthCheck> {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }

  @Mutation(() => SuccessResponse)
  async processTick(): Promise<SuccessResponse> {
    try {
      await this.gameTickService.processTick();
      return {
        success: true,
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

  @Query(() => GameStateResponse)
  async getGameState(): Promise<GameStateResponse> {
    try {
      await this.gameTickService.getGameState(); // Ensure service is working
      const monsters = await this.monsterService.getAllMonsters();

      // Transform the raw state to match our GraphQL GameState type
      const gameState: GameState = {
        currentTime: new Date().toISOString(),
        totalPlayers: 0, // We'll need to get this from PlayerService if needed
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

  @Query(() => [Monster])
  async getAllMonsters(): Promise<Monster[]> {
    const monsters = await this.monsterService.getAllMonsters();
    return monsters as Monster[];
  }

  @Mutation(() => MonsterResponse)
  async spawnMonster(
    @Args('input') input: SpawnMonsterInput,
  ): Promise<MonsterResponse> {
    try {
      const monster = await this.monsterService.spawnMonster(
        input.x,
        input.y,
        1, // Default biome ID for now
      );

      return {
        success: true,
        data: monster as Monster,
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
