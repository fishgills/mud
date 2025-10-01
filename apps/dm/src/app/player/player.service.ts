import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { calculateDirection } from '../shared/direction.util';
import { getPrismaClient, Player } from '@mud/database';
import {
  CreatePlayerDto,
  MovePlayerDto,
  PlayerStatsDto,
} from './dto/player.dto';
import { GraphQLError } from 'graphql';
import { WorldService } from '../world/world.service';
import { isWaterBiome } from '../shared/biome.util';
import { WORLD_CHUNK_SIZE } from '@mud/constants';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private prisma = getPrismaClient();

  constructor(private readonly worldService: WorldService) {}

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const { slackId, name, x, y } = createPlayerDto;

    // // Check if player already exists
    const existingPlayer = await this.prisma.player.findUnique({
      where: { slackId },
    });

    if (existingPlayer) {
      throw new GraphQLError(`Player already exists`, {
        extensions: {
          code: 'PLAYER_EXISTS',
          slackId,
        },
      });
    }

    // Find a spawn position that's at least 100 tiles away from existing players
    const spawnPosition = await this.findValidSpawnPosition(x, y);

    // Generate random starting stats and calculate maxHP
    const { strength, agility, health, maxHp } = this.generateRandomStats();

    return this.prisma.player.create({
      data: {
        slackId,
        name,
        x: spawnPosition.x,
        y: spawnPosition.y,
        hp: maxHp,
        maxHp,
        strength,
        agility,
        health,
        level: 1,
        isAlive: true,
      },
    });
  }

  /**
   *
   * @param slackId The Slack ID of the player to retrieve
   * @returns
   */
  async getPlayer(slackId: string): Promise<Player> {
    this.logger.log(`[DM-DB] Looking up player with slackId: ${slackId}`);
    const player = await this.prisma.player.findUnique({
      where: { slackId },
    });

    if (!player) {
      this.logger.warn(`[DM-DB] Player not found for slackId: ${slackId}`);
      throw new NotFoundException(`Player not found`);
    }

    this.logger.log(
      `[DM-DB] Found player for slackId: ${slackId}, player ID: ${player.id}, name: ${player.name}`,
    );
    return player;
  }

  async getPlayerByName(name: string): Promise<Player> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new GraphQLError('Player name is required', {
        extensions: {
          code: 'PLAYER_NAME_REQUIRED',
        },
      });
    }

    this.logger.log(`[DM-DB] Looking up player with name: ${trimmedName}`);
    const matches = await this.prisma.player.findMany({
      where: {
        name: {
          equals: trimmedName,
          mode: 'insensitive',
        },
      },
      orderBy: { id: 'asc' },
    });

    if (matches.length === 0) {
      this.logger.warn(`[DM-DB] Player not found for name: ${trimmedName}`);
      throw new NotFoundException(`Player not found`);
    }

    if (matches.length > 1) {
      this.logger.warn(
        `[DM-DB] Multiple players found for name: ${trimmedName} (count: ${matches.length})`,
      );
      throw new GraphQLError(
        `Multiple players found with the name "${trimmedName}". Please specify the player's Slack handle instead.`,
        {
          extensions: {
            code: 'PLAYER_NAME_AMBIGUOUS',
            name: trimmedName,
            matches: matches.map((player) => player.id),
          },
        },
      );
    }

    const player = matches[0];
    this.logger.log(
      `[DM-DB] Found player for name: ${trimmedName}, player ID: ${player.id}, slackId: ${player.slackId}`,
    );
    return player;
  }

  async getPlayerByIdentifier({
    slackId,
    name,
  }: {
    slackId?: string | null;
    name?: string | null;
  }): Promise<Player> {
    if (slackId) {
      return this.getPlayer(slackId);
    }
    if (name) {
      return this.getPlayerByName(name);
    }

    throw new GraphQLError('A Slack ID or player name must be provided', {
      extensions: {
        code: 'PLAYER_IDENTIFIER_REQUIRED',
      },
    });
  }

  async getAllPlayers(): Promise<Player[]> {
    return this.prisma.player.findMany();
  }

  /**
   * Update the lastAction timestamp for a player (used for activity tracking)
   * @param slackId The Slack ID of the player
   */
  async updateLastAction(slackId: string): Promise<void> {
    await this.prisma.player.update({
      where: { slackId },
      data: { lastAction: new Date() },
    });
  }

  /**
   * Check if there are any players who have been active within the specified time window
   * @param minutesThreshold How many minutes back to check for activity (default: 30)
   * @returns true if any players have been active within the threshold
   */
  async hasActivePlayers(minutesThreshold: number = 30): Promise<boolean> {
    const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);
    const count = await this.prisma.player.count({
      where: {
        lastAction: {
          gte: thresholdDate,
        },
      },
    });
    return count > 0;
  }

  async movePlayer(slackId: string, moveDto: MovePlayerDto): Promise<Player> {
    const player = await this.getPlayer(slackId);
    let newX = player.x;
    let newY = player.y;

    const hasX = typeof moveDto.x === 'number';
    const hasY = typeof moveDto.y === 'number';

    if (hasX || hasY) {
      if (!hasX || !hasY) {
        throw new Error(
          'Both x and y coordinates are required to move to a location.',
        );
      }
      newX = moveDto.x as number;
      newY = moveDto.y as number;
    } else if (moveDto.direction) {
      switch (moveDto.direction.toLowerCase()) {
        case 'n':
        case 'north':
          newY += 1;
          break;
        case 's':
        case 'south':
          newY -= 1;
          break;
        case 'e':
        case 'east':
          newX += 1;
          break;
        case 'w':
        case 'west':
          newX -= 1;
          break;
        default:
          throw new Error('Invalid direction. Use n, s, e, w');
      }
    } else {
      throw new Error(
        'Invalid movement request. Provide a direction or coordinates.',
      );
    }

    const targetTile = await this.worldService.getTileInfo(newX, newY);
    const movingByCoordinates = hasX && hasY;

    if (!movingByCoordinates && isWaterBiome(targetTile.biomeName)) {
      throw new Error(
        `You cannot move into water (${targetTile.biomeName || 'unknown biome'}).`,
      );
    }

    return this.prisma.player.update({
      where: { slackId },
      data: {
        x: newX,
        y: newY,
        lastAction: new Date(),
      },
    });
  }

  async updatePlayerStats(
    slackId: string,
    statsDto: PlayerStatsDto,
  ): Promise<Player> {
    const updateData: any = {
      lastAction: new Date(),
      updatedAt: new Date(),
    };

    if (statsDto.hp !== undefined) updateData.hp = statsDto.hp;
    if (statsDto.xp !== undefined) updateData.xp = statsDto.xp;
    if (statsDto.gold !== undefined) updateData.gold = statsDto.gold;
    if (statsDto.level !== undefined) updateData.level = statsDto.level;
    if (statsDto.skillPoints !== undefined)
      updateData.skillPoints = statsDto.skillPoints;
    if (statsDto.maxHp !== undefined) updateData.maxHp = statsDto.maxHp;
    if (statsDto.strength !== undefined) updateData.strength = statsDto.strength;
    if (statsDto.agility !== undefined) updateData.agility = statsDto.agility;
    if (statsDto.health !== undefined) updateData.health = statsDto.health;

    return this.prisma.player.update({
      where: { slackId },
      data: updateData,
    });
  }

  /**
   * Calculate XP required for a given level
   * Using a simple formula: level * 100
   */
  private calculateXpForLevel(level: number): number {
    return level * 100;
  }

  /**
   * Check if player should level up and apply level-up benefits
   * Returns updated player with level-up bonuses applied
   */
  async checkAndApplyLevelUp(slackId: string): Promise<{
    player: Player;
    leveledUp: boolean;
    newLevel?: number;
    skillPointsGained?: number;
    healthGained?: number;
  }> {
    const player = await this.getPlayer(slackId);
    const xpForNextLevel = this.calculateXpForLevel(player.level);

    if (player.xp < xpForNextLevel) {
      return { player, leveledUp: false };
    }

    // Calculate how many levels the player has gained
    let newLevel = player.level;
    let currentXp = player.xp;
    while (currentXp >= this.calculateXpForLevel(newLevel)) {
      newLevel++;
    }

    const levelsGained = newLevel - player.level;

    // Award skill points: 1 point every 3 levels
    let skillPointsGained = 0;
    for (let i = player.level + 1; i <= newLevel; i++) {
      if (i % 3 === 0) {
        skillPointsGained++;
      }
    }

    // Increase health: +10 HP per level (D&D Fighter-style)
    const healthGained = levelsGained * 10;
    const newMaxHp = player.maxHp + healthGained;

    // Apply the level-up
    const updatedPlayer = await this.updatePlayerStats(slackId, {
      level: newLevel,
      maxHp: newMaxHp,
      hp: player.hp + healthGained, // Also increase current HP
      skillPoints: player.skillPoints + skillPointsGained,
    });

    this.logger.log(
      `🎉 ${player.name} leveled up from ${player.level} to ${newLevel}! ` +
        `Gained ${healthGained} HP and ${skillPointsGained} skill points.`,
    );

    return {
      player: updatedPlayer,
      leveledUp: true,
      newLevel,
      skillPointsGained,
      healthGained,
    };
  }

  /**
   * Increase a player's skill using available skill points
   */
  async increaseSkill(
    slackId: string,
    skill: 'strength' | 'agility' | 'health',
  ): Promise<Player> {
    const player = await this.getPlayer(slackId);

    if (player.skillPoints <= 0) {
      throw new Error('You have no skill points available to spend.');
    }

    const currentValue = player[skill];
    if (currentValue >= 20) {
      throw new Error(`Your ${skill} is already at maximum (20).`);
    }

    const updates: PlayerStatsDto = {
      [skill]: currentValue + 1,
      skillPoints: player.skillPoints - 1,
    };

    // If increasing health, also increase maxHp
    if (skill === 'health') {
      updates.maxHp = player.maxHp + 2; // +2 max HP per health point
    }

    return this.updatePlayerStats(slackId, updates);
  }

  async rerollPlayerStats(slackId: string): Promise<Player> {
    // Get the current player to check their state
    const currentPlayer = await this.getPlayer(slackId);

    // Generate new random starting stats and calculate maxHP
    const { strength, agility, health, maxHp } = this.generateRandomStats();

    // Only update HP if character is still in creation phase (HP <= 1)
    // If they've completed creation (HP > 1), preserve current HP but update maxHp
    const updateData: any = {
      strength,
      agility,
      health,
      maxHp,
      updatedAt: new Date(),
    };

    // If player is still in creation phase, set HP to maxHp
    if (currentPlayer.hp <= 1) {
      updateData.hp = maxHp;
    }

    return this.prisma.player.update({
      where: { slackId },
      data: updateData,
    });
  }

  async healPlayer(slackId: string, amount: number): Promise<Player> {
    const player = await this.getPlayer(slackId);
    const newHp = Math.min(player.hp + amount, player.maxHp);

    return this.prisma.player.update({
      where: { slackId },
      data: { hp: newHp },
    });
  }

  async damagePlayer(slackId: string, damage: number): Promise<Player> {
    const player = await this.getPlayer(slackId);
    const newHp = Math.max(player.hp - damage, 0);
    const isAlive = newHp > 0;

    return this.prisma.player.update({
      where: { slackId },
      data: {
        hp: newHp,
        isAlive,
      },
    });
  }

  async respawnPlayer(slackId: string): Promise<Player> {
    const player = await this.getPlayer(slackId);

    // Find a respawn position near other players
    const respawnPosition = await this.findRespawnPositionNearPlayers(slackId);

    return this.prisma.player.update({
      where: { slackId },
      data: {
        hp: player.maxHp,
        isAlive: true,
        x: respawnPosition.x,
        y: respawnPosition.y,
      },
    });
  }

  async deletePlayer(slackId: string): Promise<Player> {
    // First check if player exists (will throw NotFoundException if not found)
    await this.getPlayer(slackId);

    // Delete the player from the database
    return this.prisma.player.delete({
      where: { slackId },
    });
  }

  async getPlayersAtLocation(
    x: number,
    y: number,
    excludeSlackId?: string,
  ): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: {
        x,
        y,
        isAlive: true,
        ...(excludeSlackId ? { slackId: { not: excludeSlackId } } : {}),
      },
    });
  }

  /**
   * Get nearby players within a certain radius
   * @param currentX The current X coordinate of the player
   * @param currentY The current Y coordinate of the player
   * @param excludeSlackId The Slack ID to exclude from the results
   * @param radius The radius to search within
   * @param limit The maximum number of players to return
   * @returns An array of nearby players with their distance and direction
   */
  async getNearbyPlayers(
    currentX: number,
    currentY: number,
    excludeSlackId?: string,
    radius = Infinity,
    limit = 10,
  ): Promise<
    Array<{ distance: number; direction: string; x: number; y: number }>
  > {
    // Get all players (or within bounding box if radius is finite)
    const whereClause: {
      isAlive: boolean;
      slackId?: { not: string };
      x?: { gte: number; lte: number };
      y?: { gte: number; lte: number };
    } = {
      isAlive: true,
      ...(excludeSlackId && { slackId: { not: excludeSlackId } }),
    };

    // Only add spatial constraints if radius is finite
    if (radius !== Infinity) {
      whereClause.x = { gte: currentX - radius, lte: currentX + radius };
      whereClause.y = { gte: currentY - radius, lte: currentY + radius };
    }

    const players = await this.prisma.player.findMany({
      where: whereClause,
    });

    // Calculate actual distance and filter by circular radius
    const playersWithDistance = players
      .map((player) => {
        // const distancee = Math.sqrt(
        //   (player.x - currentX) ** 2 + (player.y - currentY) ** 2,
        // );
        const direction = calculateDirection(
          currentX,
          currentY,
          player.x,
          player.y,
        );

        const distance = this.calculateDistance(
          currentX,
          currentY,
          player.x,
          player.y,
        );

        return {
          distance: Math.round(distance * 10) / 10,
          direction,
          x: player.x,
          y: player.y,
        };
      })
      .filter((player) => radius === Infinity || player.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return playersWithDistance;
  }

  // direction util now imported from shared/direction.util

  private async findValidSpawnPosition(
    preferredX?: number,
    preferredY?: number,
  ): Promise<{ x: number; y: number }> {
    const MIN_DISTANCE = 100;
    const MAX_ATTEMPTS = 50;
    const SEARCH_RADIUS = 1000; // Maximum distance from origin to search

    // Get all existing alive players
    const existingPlayers = await this.prisma.player.findMany({
      where: { isAlive: true },
      select: { x: true, y: true },
    });

    // If no existing players, use preferred position or origin
    if (existingPlayers.length === 0) {
      return {
        x: preferredX ?? 0,
        y: preferredY ?? 0,
      };
    }

    // Try to find a valid spawn position
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let candidateX: number;
      let candidateY: number;

      if (
        attempt === 0 &&
        preferredX !== undefined &&
        preferredY !== undefined
      ) {
        // First attempt: try the preferred position
        candidateX = preferredX;
        candidateY = preferredY;
      } else {
        // Generate random position within search radius
        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * SEARCH_RADIUS;
        candidateX = Math.floor(Math.cos(angle) * distance);
        candidateY = Math.floor(Math.sin(angle) * distance);
      }

      // Check if this position is far enough from all existing players
      const isValidPosition = existingPlayers.every((player) => {
        const distance = Math.sqrt(
          Math.pow(candidateX - player.x, 2) +
            Math.pow(candidateY - player.y, 2),
        );
        return distance >= MIN_DISTANCE;
      });

      if (isValidPosition) {
        return { x: candidateX, y: candidateY };
      }
    }

    // If we couldn't find a valid position after MAX_ATTEMPTS,
    // find the position that's farthest from the nearest player
    let bestPosition = { x: 0, y: 0 };
    let maxMinDistance = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * SEARCH_RADIUS;
      const candidateX = Math.floor(Math.cos(angle) * distance);
      const candidateY = Math.floor(Math.sin(angle) * distance);

      // Find minimum distance to any existing player
      const minDistance = Math.min(
        ...existingPlayers.map((player) =>
          Math.sqrt(
            Math.pow(candidateX - player.x, 2) +
              Math.pow(candidateY - player.y, 2),
          ),
        ),
      );

      if (minDistance > maxMinDistance) {
        maxMinDistance = minDistance;
        bestPosition = { x: candidateX, y: candidateY };
      }
    }

    return bestPosition;
  }

  /**
   * Generates random character stats and calculates maxHP
   * Used by both createPlayer and rerollPlayerStats to maintain consistency
   */
  private generateRandomStats(): {
    strength: number;
    agility: number;
    health: number;
    maxHp: number;
  } {
    // D&D-style generation: Roll 4d6, drop the lowest, sum the rest
    const roll4d6DropLowest = (): number => {
      const rolls = [
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ];
      rolls.sort((a, b) => a - b); // ascending
      return rolls[1] + rolls[2] + rolls[3];
    };

    const strength = roll4d6DropLowest();
    const agility = roll4d6DropLowest();
    const health = roll4d6DropLowest();

    // Calculate max HP based on health attribute (existing formula)
    const maxHp = 80 + health * 2;

    return { strength, agility, health, maxHp };
  }

  private async findRespawnPositionNearPlayers(
    respawningPlayerSlackId: string,
  ): Promise<{ x: number; y: number }> {
    const RESPAWN_DISTANCE = 100; // Distance from other players to respawn
    const MAX_ATTEMPTS = 50;

    // Get all living players except the one being respawned
    const livingPlayers = await this.prisma.player.findMany({
      where: {
        isAlive: true,
        slackId: { not: respawningPlayerSlackId },
      },
      select: { x: true, y: true },
    });

    // If no other living players, use origin as fallback
    if (livingPlayers.length === 0) {
      return { x: 0, y: 0 };
    }

    // Choose a random living player as reference point
    const referencePlayer =
      livingPlayers[Math.floor(Math.random() * livingPlayers.length)];

    // Try to find a position approximately 100 tiles away from the reference player
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      // Generate a random angle and use fixed distance of ~100 tiles
      const angle = Math.random() * 2 * Math.PI;
      const distance = RESPAWN_DISTANCE + Math.random() * 50 - 25; // 75-125 tiles away

      const candidateX = Math.floor(
        referencePlayer.x + Math.cos(angle) * distance,
      );
      const candidateY = Math.floor(
        referencePlayer.y + Math.sin(angle) * distance,
      );

      // Check if this position is far enough from all living players
      const isValidPosition = livingPlayers.every((player) => {
        const distanceToPlayer = Math.sqrt(
          Math.pow(candidateX - player.x, 2) +
            Math.pow(candidateY - player.y, 2),
        );
        return distanceToPlayer >= WORLD_CHUNK_SIZE; // At least 50 tiles from any other player
      });

      if (isValidPosition) {
        return { x: candidateX, y: candidateY };
      }
    }

    // If we couldn't find a valid position, just place them near the reference player
    // with some random offset
    const fallbackAngle = Math.random() * 2 * Math.PI;
    const fallbackDistance = RESPAWN_DISTANCE;

    return {
      x: Math.floor(
        referencePlayer.x + Math.cos(fallbackAngle) * fallbackDistance,
      ),
      y: Math.floor(
        referencePlayer.y + Math.sin(fallbackAngle) * fallbackDistance,
      ),
    };
  }

  calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
}
