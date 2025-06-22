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
import { OpenaiService } from '../../../openai/openai.service';
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
    private aiService: OpenaiService,
  ) {}

  @Mutation(() => PlayerResponse)
  async createPlayer(
    @Args('input') input: CreatePlayerInput,
  ): Promise<PlayerResponse> {
    try {
      const player = await this.playerService.createPlayer(input);
      return {
        success: true,
        data: player as Player,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to create player',
      };
    }
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

      // Batch all location-related data fetching in parallel
      const [tileInfoWithNearby, monsters, nearbyPlayers, surroundingTiles] =
        await Promise.all([
          this.worldService.getTileInfoWithNearby(player.x, player.y),
          this.monsterService.getMonstersAtLocation(player.x, player.y),
          this.playerService.getNearbyPlayers(
            player.x,
            player.y,
            slackId, // Exclude the current player
            Infinity, // Infinite search radius
            10, // Top 10 closest players
          ),
          this.worldService.getSurroundingTiles(
            player.x,
            player.y,
            1, // 1 tile radius around the player
          ),
        ]);

      // Map surrounding tiles with direction information
      const surroundingTilesWithDirection: SurroundingTile[] =
        surroundingTiles.map((tile) => ({
          x: tile.x,
          y: tile.y,
          biomeName: tile.biomeName,
          description: tile.description || '',
          direction: this.calculateDirection(
            player.x,
            player.y,
            tile.x,
            tile.y,
          ),
        }));

      // Prepare data for AI generation
      const gptJson = {
        ...tileInfoWithNearby.tile,
        nearbyBiomes: tileInfoWithNearby.nearbyBiomes,
        nearbySettlements: tileInfoWithNearby.nearbySettlements,
        currentSettlement: tileInfoWithNearby.currentSettlement,
        surroundingTiles: surroundingTilesWithDirection,
      };

      // Batch AI calls in parallel
      const aiPromises: Promise<{ output_text: string }>[] = [];
      const needsDescription =
        !tileInfoWithNearby.tile.description ||
        tileInfoWithNearby.tile.description.trim() === '';

      if (needsDescription) {
        aiPromises.push(
          this.aiService.getText(
            `Below is json information about the player's current position in the world. ` +
              `if 'currentSettlement' exists, the player is INSIDE a settlement. The intensity property describes how dense the city is at this location on a scale of 0 to 1. ` +
              `The surroundingTiles array contains information about the 8 tiles immediately surrounding the player's current position, including their biome, description, and direction from the player. ` +
              `Use this information to create a cohesive description that considers the immediate surroundings and transitions between different areas. Try to keep it under 150 words. Doesn't have to be exactly 150 words. \n ${JSON.stringify(
                gptJson,
              )}`,
          ),
        );
      }

      // Always add player info generation
      aiPromises.push(
        this.aiService.getText(
          `Below is a list of nearby players with their distance and direction from the player. Write a short paragraph describing the players relative to the current player. \n ${JSON.stringify(
            nearbyPlayers,
          )}`,
        ),
      );

      // Execute all AI calls in parallel
      const aiResults = await Promise.all(aiPromises);

      // Process AI results
      let description = tileInfoWithNearby.tile.description || '';
      let playerInfo: string;

      if (needsDescription) {
        description = aiResults[0].output_text;
        playerInfo = aiResults[1].output_text;

        // Save the generated description back to the tile (don't await to avoid blocking)
        this.worldService
          .updateTileDescription(player.x, player.y, description || '')
          .catch((error) => {
            // Log the error but don't fail the request
            console.warn(
              `Failed to save tile description for (${player.x}, ${player.y}):`,
              error instanceof Error ? error.message : 'Unknown error',
            );
          });
      } else {
        playerInfo = aiResults[0].output_text;
      }

      // Convert tile info to TileInfo format
      const tileInfo: TileInfo = {
        x: tileInfoWithNearby.tile.x,
        y: tileInfoWithNearby.tile.y,
        biomeName: tileInfoWithNearby.tile.biomeName,
        description: description,
        height: tileInfoWithNearby.tile.height,
        temperature: tileInfoWithNearby.tile.temperature,
        moisture: tileInfoWithNearby.tile.moisture,
      };

      const movementData: PlayerMovementData = {
        player: player as Player,
        location: tileInfo,
        monsters: monsters as Monster[],
        playerInfo,
        surroundingTiles: surroundingTilesWithDirection,
        description,
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

      return {
        success: true,
        data: movementData,
      };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : 'Failed to move player',
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
