import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
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
  PlayerMoveResponse,
  PlayerMovementData,
  SurroundingTile,
  NearbyPlayerInfo,
} from '../types/response.types';
import {
  CreatePlayerInput,
  MovePlayerInput,
  PlayerStatsInput,
  AttackInput,
  TargetType,
} from '../inputs/player.input';
import { Logger } from '@nestjs/common';

@Resolver(() => Player)
export class PlayerResolver {
  private logger = new Logger(PlayerResolver.name);
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
  async getPlayer(@Args('slackId') slackId: string): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.getPlayer(slackId);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
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

  @Mutation(() => PlayerMoveResponse)
  async movePlayer(
    @Args('slackId') slackId: string,
    @Args('input') input: MovePlayerInput,
  ): Promise<PlayerMoveResponse> {
    try {
      const player = await this.playerService.movePlayer(slackId, input);
      const movementData = await this.buildMovementData(player, slackId);
      this.logger.debug(
        `Moved to (${player.x}, ${player.y}) with ${movementData.monsters.length} monster(s) nearby.`,
      );
      return { success: true, data: movementData };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to move player',
      };
    }
  }

  @Query(() => PlayerMoveResponse)
  async getMovementView(
    @Args('slackId') slackId: string,
  ): Promise<PlayerMoveResponse> {
    try {
      const player = await this.playerService.getPlayer(slackId);
      const movementData = await this.buildMovementData(player, slackId);
      return { success: true, data: movementData };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to fetch movement view',
      };
    }
  }

  // Helper method for direction calculation
  private calculateDirection(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): string {
    const dx = toX - fromX;
    const dy = toY - fromY;

    // Calculate angle in radians, then convert to degrees
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;

    // Normalize angle to 0-360 range
    const normalizedAngle = (angle + 360) % 360;

    // Convert to compass direction
    if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'east';
    if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'northeast';
    if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'north';
    if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'northwest';
    if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'west';
    if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'southwest';
    if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'south';
    return 'southeast';
  }

  // Shared builder for PlayerMovementData used by both movePlayer and getMovementView
  private async buildMovementData(
    player: Player,
    slackId: string,
  ): Promise<PlayerMovementData> {
    const [tileInfoWithNearby, monsters, nearbyPlayers, surroundingTiles] =
      await Promise.all([
        this.worldService.getTileInfoWithNearby(player.x, player.y),
        this.monsterService.getMonstersAtLocation(player.x, player.y),
        this.playerService.getNearbyPlayers(
          player.x,
          player.y,
          slackId,
          Infinity,
          10,
        ),
        this.worldService.getSurroundingTiles(player.x, player.y, 1),
      ]);

    const surroundingTilesWithDirection: SurroundingTile[] =
      surroundingTiles.map((tile) => ({
        x: tile.x,
        y: tile.y,
        biomeName: tile.biomeName,
        description: tile.description || '',
        direction: this.calculateDirection(player.x, player.y, tile.x, tile.y),
      }));

    const tileInfo: TileInfo = {
      x: tileInfoWithNearby.tile.x,
      y: tileInfoWithNearby.tile.y,
      biomeName: tileInfoWithNearby.tile.biomeName,
      description: tileInfoWithNearby.tile.description || '',
      height: tileInfoWithNearby.tile.height,
      temperature: tileInfoWithNearby.tile.temperature,
      moisture: tileInfoWithNearby.tile.moisture,
    };

    const movementData: PlayerMovementData = {
      player: player as Player,
      location: tileInfo,
      monsters: monsters as Monster[],
      nearbyPlayers: (nearbyPlayers || []).map((p) => ({
        distance: p.distance,
        direction: p.direction,
        x: p.x,
        y: p.y,
      })) as NearbyPlayerInfo[],
      playerInfo: '',
      surroundingTiles: surroundingTilesWithDirection,
      description: tileInfo.description ?? '',
      nearbyBiomes: tileInfoWithNearby.nearbyBiomes?.map(
        (b) =>
          `${b.biomeName} (${b.direction}, ${b.distance.toFixed(1)} units)`,
      ),
      nearbySettlements: tileInfoWithNearby.nearbySettlements?.map(
        (s) => `${s.name} (${s.type}, ${s.distance.toFixed(1)} units away)`,
      ),
      currentSettlement: tileInfoWithNearby.currentSettlement
        ? `${tileInfoWithNearby.currentSettlement.name} (${tileInfoWithNearby.currentSettlement.type}, intensity: ${tileInfoWithNearby.currentSettlement.intensity})`
        : undefined,
    };

    return movementData;
  }

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

  @Mutation(() => CombatResponse)
  async attack(
    @Args('slackId') slackId: string,
    @Args('input') input: AttackInput,
  ): Promise<CombatResponse> {
    try {
      let result;

      if (input.targetType === TargetType.MONSTER) {
        result = await this.combatService.playerAttackMonster(
          slackId,
          input.targetId,
        );
      } else if (input.targetType === TargetType.PLAYER) {
        // For player vs player, we need to find the target player by ID
        const allPlayers = await this.playerService.getAllPlayers();
        const targetPlayer = allPlayers.find((p) => p.id === input.targetId);

        if (!targetPlayer) {
          throw new Error('Target player not found');
        }

        result = await this.combatService.playerAttackPlayer(
          slackId,
          targetPlayer.slackId,
        );
      } else {
        throw new Error('Invalid target type');
      }

      return {
        success: true,
        data: result as CombatResult,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Attack failed',
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
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Respawn failed',
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
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to delete character',
      };
    }
  }

  @Query(() => PlayerStats)
  async getPlayerStats(@Args('slackId') slackId: string): Promise<PlayerStats> {
    const player = await this.playerService.getPlayer(slackId);

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
