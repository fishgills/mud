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
  PlayerAttribute,
} from '../inputs/player.input';
import { EntityToGraphQLAdapter } from '../adapters/entity-to-graphql.adapter';

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
    // Support both old (slackId) and new (clientId + clientType) formats
    if (!input.clientId && !input.slackId) {
      return {
        success: false,
        message: 'Either clientId/clientType or slackId must be provided',
      };
    }

    const entity = await this.playerService.createPlayer(input);
    const player = EntityToGraphQLAdapter.playerEntityToGraphQL(entity);
    return {
      success: true,
      data: player,
    };
  }

  @Query(() => PlayerResponse)
  async getPlayer(
    @Args('slackId', { nullable: true }) slackId?: string,
    @Args('clientId', { nullable: true }) clientId?: string,
    @Args('name', { nullable: true }) name?: string,
  ): Promise<PlayerResponse> {
    if (!slackId && !clientId && !name) {
      return {
        success: false,
        message: 'A clientId, slackId, or player name must be provided',
      };
    }

    const identifier = clientId
      ? `clientId: ${clientId}`
      : slackId
        ? `slackId: ${slackId}`
        : `name: ${name ?? 'unknown'}`;
    this.logger.log(`[DM-AUTH] Received getPlayer request for ${identifier}`);
    try {
      this.logger.log(
        `[DM-AUTH] Calling playerService.getPlayer for ${identifier}`,
      );
      const entity = await this.playerService.getPlayerByIdentifier({
        slackId,
        clientId,
        name,
      });
      const player = EntityToGraphQLAdapter.playerEntityToGraphQL(entity);
      this.logger.log(
        `[DM-AUTH] Successfully retrieved player for ${identifier}, player ID: ${player.id}`,
      );
      return {
        success: true,
        data: player,
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
    return EntityToGraphQLAdapter.playerEntitiesToGraphQL(players);
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
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
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
  async spendSkillPoint(
    @Args('slackId') slackId: string,
    @Args('attribute', { type: () => PlayerAttribute })
    attribute: PlayerAttribute,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.spendSkillPoint(
        slackId,
        attribute,
      );
      return {
        success: true,
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to spend skill point',
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
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
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
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
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
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
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
    return EntityToGraphQLAdapter.playerEntitiesToGraphQL(players);
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
            // Use clientId from PlayerEntity
            targetSlackId = targetPlayer.clientId || undefined;
          } else {
            throw new Error(
              'Must provide targetSlackId or targetId for player attacks',
            );
          }
        }

        if (!targetSlackId) {
          throw new Error('Target player has no valid identifier');
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
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
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
        data: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
        message: 'Player deleted successfully',
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
    const strengthModifier = Math.floor((player.attributes.strength - 10) / 2);
    const agilityModifier = Math.floor((player.attributes.agility - 10) / 2);
    const healthModifier = Math.floor((player.attributes.health - 10) / 2);

    // Calculate derived stats
    const dodgeChance = Math.max(0, (player.attributes.agility - 10) * 5); // 5% per point above 10
    const baseDamage = `1d6${strengthModifier >= 0 ? '+' : ''}${strengthModifier}`;
    const armorClass = 10 + agilityModifier; // Basic AC calculation

    // Calculate XP progress using triangular progression (base=100)
    // Threshold to reach next level L+1: T(L) = 100 * (L * (L + 1) / 2)
    const xpThreshold = (lvl: number) =>
      Math.floor(100 * (lvl * (lvl + 1)) / 2);
    const xpForNextLevel = xpThreshold(player.level);
    const prevThreshold = player.level > 1 ? xpThreshold(player.level - 1) : 0;
    const xpProgress = Math.max(0, player.xp - prevThreshold);
    const xpNeeded = Math.max(0, xpForNextLevel - player.xp);

    // Get recent combat history for this player's location
    const recentCombat = await this.combatService.getCombatLogForLocation(
      player.position.x,
      player.position.y,
    );

    return {
      player: EntityToGraphQLAdapter.playerEntityToGraphQL(player),
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
    } catch {
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
          nearbyPlayers.push(
            ...EntityToGraphQLAdapter.playerEntitiesToGraphQL(
              playersAtLocation,
            ),
          );
        }
      }
      return nearbyPlayers;
    } catch {
      return [];
    }
  }

  @ResolveField(() => [Monster], { nullable: true })
  async nearbyMonsters(@Parent() player: Player): Promise<Monster[]> {
    try {
      const monsters = await this.monsterService.getMonstersAtLocation(
        player.x,
        player.y,
      );
      return EntityToGraphQLAdapter.monsterEntitiesToGraphQL(monsters);
    } catch {
      return [];
    }
  }
}
