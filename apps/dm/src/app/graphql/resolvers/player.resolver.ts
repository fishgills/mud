import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { PlayerService } from '../../player/player.service';
import { MonsterService } from '../../monster/monster.service';
import { CombatService } from '../../combat/combat.service';
import { WorldService } from '../../world/world.service';
import { Player } from '../models/player.model';
import { Monster } from '../models/monster.model';
import { TileInfo } from '../models/tile-info.model';
import { CombatLog } from '../models/combat-log.model';
import {
  PlayerResponse,
  CombatResponse,
  PlayerStats,
  CombatResult,
} from '../types/response.types';
import {
  CreatePlayerInput,
  PlayerStatsInput,
  AttackInput,
  TargetType,
} from '../inputs/player.input';

@Resolver(() => Player)
export class PlayerResolver {
  private readonly logger = new Logger(PlayerResolver.name);

  constructor(
    private playerService: PlayerService,
    private monsterService: MonsterService,
    private combatService: CombatService,
    private worldService: WorldService,
  ) {}

  @Mutation(() => PlayerResponse)
  async createPlayer(
    @Args('input') input: CreatePlayerInput,
  ): Promise<PlayerResponse> {
    const player = await this.playerService.createPlayer(input);
    return {
      success: true,
      data: player as Player,
    };
  }

  @Query(() => PlayerResponse)
  async getPlayer(
    @Args('slackId', { nullable: true }) slackId?: string,
    @Args('name', { nullable: true }) name?: string,
  ): Promise<PlayerResponse> {
    if (!slackId && !name) {
      return {
        success: false,
        message: 'A Slack ID or player name must be provided',
      };
    }

    const identifier = slackId
      ? `slackId: ${slackId}`
      : `name: ${name ?? 'unknown'}`;
    this.logger.log(
      `[DM-AUTH] Received getPlayer request for ${identifier}`,
    );
    try {
      this.logger.log(
        `[DM-AUTH] Calling playerService.getPlayer for ${identifier}`,
      );
      const player = await this.playerService.getPlayerByIdentifier({
        slackId,
        name,
      });
      this.logger.log(
        `[DM-AUTH] Successfully retrieved player for ${identifier}, player ID: ${player.id}`,
      );
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      this.logger.error(
        `[DM-AUTH] Error getting player for ${identifier}`,
        error instanceof Error ? error.stack : error,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Player not found',
      };
    }
  }

  @Query(() => [Player])
  async getAllPlayers(): Promise<Player[]> {
    const players = await this.playerService.getAllPlayers();
    return players as Player[];
  }

  // movement-related resolvers have been moved to MovementResolver

  @Mutation(() => PlayerResponse)
  async updatePlayerStats(
    @Args('slackId') slackId: string,
    @Args('input') input: PlayerStatsInput,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.updatePlayerStats(slackId, input);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to update player stats',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async rerollPlayerStats(
    @Args('slackId') slackId: string,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.rerollPlayerStats(slackId);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to reroll player stats',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async healPlayer(
    @Args('slackId') slackId: string,
    @Args('amount') amount: number,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.healPlayer(slackId, amount);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to heal player',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async damagePlayer(
    @Args('slackId') slackId: string,
    @Args('damage') damage: number,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.damagePlayer(slackId, damage);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to damage player',
      };
    }
  }

  @Query(() => [Player])
  async getPlayersAtLocation(
    @Args('x') x: number,
    @Args('y') y: number,
  ): Promise<Player[]> {
    const players = await this.playerService.getPlayersAtLocation(x, y);
    return players as Player[];
  }

  @Mutation(() => CombatResponse, {
    description: 'Attack a monster or another player at your current location',
  })
  async attack(
    @Args('slackId') slackId: string,
    @Args('input') input: AttackInput,
  ): Promise<CombatResponse> {
    try {
      let result;

      if (input.targetType === TargetType.MONSTER) {
        if (typeof input.targetId !== 'number') {
          throw new Error('targetId is required for monster attacks');
        }
        result = await this.combatService.playerAttackMonster(
          slackId,
          input.targetId,
        );
      } else if (input.targetType === TargetType.PLAYER) {
        // Support targeting by slackId or numeric ID
        let targetSlackId: string | undefined =
          input.targetSlackId ?? undefined;
        if (!targetSlackId) {
          if (typeof input.targetId === 'number') {
            const allPlayers = await this.playerService.getAllPlayers();
            const targetPlayer = allPlayers.find(
              (p) => p.id === input.targetId,
            );
            if (!targetPlayer) {
              throw new Error('Target player not found');
            }
            targetSlackId = targetPlayer.slackId;
          } else {
            throw new Error(
              'Must provide targetSlackId or targetId for player attacks',
            );
          }
        }

        const ignoreLocation = input.ignoreLocation === true;
        result = await this.combatService.playerAttackPlayer(
          slackId,
          targetSlackId,
          ignoreLocation,
        );
      } else {
        throw new Error('Invalid target type');
      }

      return {
        success: true,
        data: result as CombatResult,
      };
    } catch (_error) {
      return {
        success: false,
        message: _error instanceof Error ? _error.message : 'Attack failed',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async respawn(@Args('slackId') slackId: string): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.respawnPlayer(slackId);
      return {
        success: true,
        data: player as Player,
        message: 'You have been resurrected at the starting location!',
      };
    } catch (_error) {
      return {
        success: false,
        message: _error instanceof Error ? _error.message : 'Respawn failed',
      };
    }
  }

  @Mutation(() => PlayerResponse)
  async deletePlayer(
    @Args('slackId') slackId: string,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.deletePlayer(slackId);
      return {
        success: true,
        data: player as Player,
        message: 'Character has been successfully deleted.',
      };
    } catch (_error) {
      return {
        success: false,
        message:
          _error instanceof Error
            ? _error.message
            : 'Failed to delete character',
      };
    }
  }

  @Query(() => PlayerStats)
  async getPlayerStats(
    @Args('slackId', { nullable: true }) slackId?: string,
    @Args('name', { nullable: true }) name?: string,
  ): Promise<PlayerStats> {
    const player = await this.playerService.getPlayerByIdentifier({
      slackId,
      name,
    });

    // Calculate D&D-like modifiers
    const strengthModifier = Math.floor((player.strength - 10) / 2);
    const agilityModifier = Math.floor((player.agility - 10) / 2);
    const healthModifier = Math.floor((player.health - 10) / 2);

    // Calculate derived stats
    const dodgeChance = Math.max(0, (player.agility - 10) * 5); // 5% per point above 10
    const baseDamage = `1d6${strengthModifier >= 0 ? '+' : ''}${strengthModifier}`;
    const armorClass = 10 + agilityModifier; // Basic AC calculation

    // Calculate XP needed for next level (simple progression: level * 100)
    const xpForNextLevel = player.level * 100;
    const xpProgress = player.xp - (player.level - 1) * 100;
    const xpNeeded = xpForNextLevel - player.xp;

    // Get recent combat history for this player's location
    const recentCombat = await this.combatService.getCombatLogForLocation(
      player.x,
      player.y,
    );

    return {
      player: player as Player,
      strengthModifier,
      agilityModifier,
      healthModifier,
      dodgeChance,
      baseDamage,
      armorClass,
      xpForNextLevel,
      xpProgress,
      xpNeeded,
      recentCombat: recentCombat as CombatLog[],
    };
  }

  // Field resolvers for on-demand data loading
  @ResolveField(() => TileInfo, { nullable: true })
  async currentTile(@Parent() player: Player): Promise<TileInfo | null> {
    try {
      const tileInfo = await this.worldService.getTileInfo(player.x, player.y);
      return {
        x: tileInfo.x,
        y: tileInfo.y,
        biomeName: tileInfo.biomeName,
        description: tileInfo.description,
        height: tileInfo.height,
        temperature: tileInfo.temperature,
        moisture: tileInfo.moisture,
      };
    } catch (error) {
      return null;
    }
  }

  @ResolveField(() => [Player], { nullable: true })
  async nearbyPlayers(@Parent() player: Player): Promise<Player[]> {
    try {
      // Get players within a 3x3 grid around the current player
      const nearbyPlayers: Player[] = [];
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue; // Skip the current player's location
          const playersAtLocation =
            await this.playerService.getPlayersAtLocation(
              player.x + dx,
              player.y + dy,
            );
          nearbyPlayers.push(...(playersAtLocation as Player[]));
        }
      }
      return nearbyPlayers;
    } catch (error) {
      return [];
    }
  }

  @ResolveField(() => [Monster], { nullable: true })
  async nearbyMonsters(@Parent() player: Player): Promise<Monster[]> {
    try {
      return (await this.monsterService.getMonstersAtLocation(
        player.x,
        player.y,
      )) as Monster[];
    } catch (error) {
      return [];
    }
  }
}
