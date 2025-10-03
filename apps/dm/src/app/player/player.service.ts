import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { PlayerFactory, ClientType, PlayerEntity, EventBus } from '@mud/engine';
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

  private readonly SKILL_POINT_INTERVAL = 4;
  private readonly SKILL_POINTS_PER_INTERVAL = 2;
  private readonly HIT_DIE_AVERAGE = 6; // Average roll for a d10
  private readonly BASE_HP_PER_HEALTH_POINT = 2; // HP gained per health attribute point

  constructor(private readonly worldService: WorldService) {}

  private getXpForNextLevel(level: number): number {
    return level * 100;
  }

  private getConstitutionModifier(health: number): number {
    return Math.floor((health - 10) / 2);
  }

  private calculateLevelUpHpGain(health: number): number {
    const modifier = this.getConstitutionModifier(health);
    return Math.max(1, this.HIT_DIE_AVERAGE + modifier);
  }

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<PlayerEntity> {
    const { slackId, clientId, clientType, name, x, y } = createPlayerDto;

    // Validate that we have either clientId or slackId
    if (!clientId && !slackId) {
      throw new GraphQLError('Either clientId or slackId must be provided', {
        extensions: {
          code: 'CLIENT_ID_REQUIRED',
        },
      });
    }

    // Determine final clientId and clientType
    let finalClientId: string;
    let finalClientType: ClientType;

    if (clientId) {
      finalClientId = clientId;
      finalClientType = (clientType || 'slack') as ClientType;
    } else if (slackId) {
      // Legacy format: just use slackId (PlayerFactory will handle prefixing)
      finalClientId = slackId;
      finalClientType = 'slack';
    } else {
      throw new GraphQLError('Either clientId or slackId must be provided', {
        extensions: {
          code: 'CLIENT_ID_REQUIRED',
        },
      });
    }

    // Check if player already exists - PlayerFactory.load handles both formats
    const existing = await PlayerFactory.load(finalClientId, finalClientType);
    if (existing) {
      throw new GraphQLError(`Player already exists`, {
        extensions: {
          code: 'PLAYER_EXISTS',
          clientId: finalClientId,
        },
      });
    }

    // Find a spawn position
    const spawnPosition = await this.findValidSpawnPosition(x, y);

    // Use PlayerFactory to create and return the player entity
    const player = await PlayerFactory.create({
      clientId: finalClientId,
      clientType: finalClientType,
      name,
      x: spawnPosition.x,
      y: spawnPosition.y,
    });

    // PlayerFactory already emits player:spawn event, no need to emit again
    this.logger.log(
      `✅ Player created: ${player.name} at (${player.position.x}, ${player.position.y})`,
    );

    return player;
  }

  /**
   * Get player by Slack ID (legacy method - use getPlayerByClientId for new code)
   */
  async getPlayer(slackId: string): Promise<PlayerEntity> {
    this.logger.log(`[DM-DB] Looking up player with slackId: ${slackId}`);
    const entity = await PlayerFactory.load(slackId, 'slack');

    if (!entity) {
      this.logger.warn(`[DM-DB] Player not found for slackId: ${slackId}`);
      throw new NotFoundException(`Player not found`);
    }

    this.logger.log(
      `[DM-DB] Found player for slackId: ${slackId}, player ID: ${entity.id}, name: ${entity.name}`,
    );
    return entity;
  }

  async getPlayerByClientId(clientId: string): Promise<PlayerEntity> {
    this.logger.log(`[DM-DB] Looking up player with clientId: ${clientId}`);

    // Parse clientType from clientId format (e.g., "slack:U123")
    const parts = clientId.split(':');
    const clientType = parts.length > 1 ? (parts[0] as ClientType) : 'slack';
    const actualId = parts.length > 1 ? parts[1] : clientId;

    const entity = await PlayerFactory.load(actualId, clientType);

    if (!entity) {
      this.logger.warn(`[DM-DB] Player not found for clientId: ${clientId}`);
      throw new NotFoundException(`Player not found`);
    }

    this.logger.log(
      `[DM-DB] Found player for clientId: ${clientId}, player ID: ${entity.id}, name: ${entity.name}`,
    );
    return entity;
  }

  async getPlayerByName(name: string): Promise<PlayerEntity> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new GraphQLError('Player name is required', {
        extensions: {
          code: 'PLAYER_NAME_REQUIRED',
        },
      });
    }

    this.logger.log(`[DM-DB] Looking up player with name: ${trimmedName}`);

    try {
      const player = await PlayerFactory.loadByName(trimmedName);

      if (!player) {
        this.logger.warn(`[DM-DB] Player not found for name: ${trimmedName}`);
        throw new NotFoundException(`Player not found`);
      }

      this.logger.log(
        `[DM-DB] Found player for name: ${trimmedName}, player ID: ${player.id}`,
      );
      return player;
    } catch (error) {
      // PlayerFactory throws error for ambiguous names
      if (
        error instanceof Error &&
        error.message.includes('Multiple players')
      ) {
        this.logger.warn(
          `[DM-DB] Multiple players found for name: ${trimmedName}`,
        );
        throw new GraphQLError(
          `Multiple players found with the name "${trimmedName}". Please specify the player's Slack handle instead.`,
          {
            extensions: {
              code: 'PLAYER_NAME_AMBIGUOUS',
              name: trimmedName,
            },
          },
        );
      }
      throw error;
    }
  }

  async getPlayerByIdentifier({
    slackId,
    clientId,
    name,
  }: {
    slackId?: string | null;
    clientId?: string | null;
    name?: string | null;
  }): Promise<PlayerEntity> {
    if (clientId) {
      return this.getPlayerByClientId(clientId);
    }
    if (slackId) {
      return this.getPlayer(slackId);
    }
    if (name) {
      return this.getPlayerByName(name);
    }

    throw new GraphQLError(
      'A client ID, Slack ID, or player name must be provided',
      {
        extensions: {
          code: 'PLAYER_IDENTIFIER_REQUIRED',
        },
      },
    );
  }

  async getAllPlayers(): Promise<PlayerEntity[]> {
    return PlayerFactory.loadAll();
  }

  /**
   * Update the lastAction timestamp for a player (used for activity tracking)
   * @param slackId The Slack ID of the player
   */
  async updateLastAction(slackId: string): Promise<void> {
    await PlayerFactory.updateLastAction(slackId, 'slack');
  }

  /**
   * Check if there are any players who have been active within the specified time window
   * @param minutesThreshold How many minutes back to check for activity (default: 30)
   * @returns true if any players have been active within the threshold
   */
  async hasActivePlayers(minutesThreshold: number = 30): Promise<boolean> {
    const count = await PlayerFactory.countActivePlayers(minutesThreshold);
    return count > 0;
  }

  async movePlayer(
    slackId: string,
    moveDto: MovePlayerDto,
  ): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);
    const oldX = player.position.x;
    const oldY = player.position.y;
    let newX = player.position.x;
    let newY = player.position.y;

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

    player.moveTo(newX, newY);

    await PlayerFactory.save(player);

    // Emit player move event (need to load fresh database model for event)
    const dbPlayer = await this.prisma.player.findUnique({
      where: { id: player.id },
    });
    if (dbPlayer) {
      await EventBus.emit({
        eventType: 'player:move',
        player: dbPlayer,
        fromX: oldX,
        fromY: oldY,
        toX: newX,
        toY: newY,
        timestamp: new Date(),
      });
    }

    return player;
  }

  async updatePlayerStats(
    slackId: string,
    statsDto: PlayerStatsDto,
  ): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);

    if (typeof statsDto.hp === 'number') {
      player.combat.hp = statsDto.hp;
    }

    if (typeof statsDto.gold === 'number') {
      player.gold = statsDto.gold;
    }

    if (typeof statsDto.level === 'number') {
      player.level = statsDto.level;
    }

    let leveledUp = false;
    let levelsGained = 0;

    if (typeof statsDto.xp === 'number') {
      player.xp = statsDto.xp;

      // Check for level-ups
      while (player.xp >= this.getXpForNextLevel(player.level)) {
        player.level += 1;
        levelsGained += 1;
        leveledUp = true;

        const hpGain = this.calculateLevelUpHpGain(player.attributes.health);
        player.combat.maxHp += hpGain;
        player.combat.hp = Math.min(
          player.combat.hp + hpGain,
          player.combat.maxHp,
        );

        if (player.level % this.SKILL_POINT_INTERVAL === 0) {
          player.skillPoints += this.SKILL_POINTS_PER_INTERVAL;
        }
      }
    }

    await PlayerFactory.save(player);

    if (leveledUp) {
      this.logger.log(
        `🎉 ${player.name} advanced ${levelsGained} level(s) to ${player.level}! Max HP is now ${player.combat.maxHp}.`,
      );
    }

    return player;
  }

  async spendSkillPoint(
    slackId: string,
    attribute: 'strength' | 'agility' | 'health',
  ): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);

    if (player.skillPoints <= 0) {
      throw new Error('No skill points available.');
    }

    // Use the entity's spendSkillPoint method
    const success = player.spendSkillPoint(attribute);

    if (!success) {
      throw new Error(
        `Cannot increase ${attribute} (max is 20 or no skill points).`,
      );
    }

    await PlayerFactory.save(player);

    const newAttributeValue = player.attributes[attribute];
    const remainingSkillPoints = player.skillPoints;

    this.logger.log(
      `⚔️ ${player.name} increased ${attribute} to ${newAttributeValue}. Remaining skill points: ${remainingSkillPoints}.`,
    );

    return player;
  }

  async rerollPlayerStats(slackId: string): Promise<PlayerEntity> {
    const currentPlayer = await this.getPlayer(slackId);

    // Generate new random starting stats
    const { strength, agility, health, maxHp } = this.generateRandomStats();

    // Update entity attributes
    currentPlayer.attributes.strength = strength;
    currentPlayer.attributes.agility = agility;
    currentPlayer.attributes.health = health;
    currentPlayer.combat.maxHp = maxHp;

    // Only update HP if character is still in creation phase (HP <= 1)
    if (currentPlayer.combat.hp <= 1) {
      currentPlayer.combat.hp = maxHp;
    }

    await PlayerFactory.save(currentPlayer);
    return currentPlayer;
  }

  async healPlayer(slackId: string, amount: number): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);
    player.heal(amount);
    await PlayerFactory.save(player);
    return player;
  }

  async damagePlayer(slackId: string, damage: number): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);
    const wasAlive = player.combat.isAlive;
    player.takeDamage(damage);
    await PlayerFactory.save(player);

    // Emit player death event if they died from this damage
    if (wasAlive && !player.combat.isAlive) {
      const dbPlayer = await this.prisma.player.findUnique({
        where: { id: player.id },
      });
      if (dbPlayer) {
        await EventBus.emit({
          eventType: 'player:death',
          player: dbPlayer,
          timestamp: new Date(),
        });
      }
      this.logger.log(
        `💀 Player ${player.name} has died at (${player.position.x}, ${player.position.y})`,
      );
    }

    return player;
  }

  async respawnPlayer(slackId: string): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);

    // Find a random spawn position
    const spawnPosition = await this.findValidSpawnPosition();

    // Reset player state
    player.combat.hp = player.combat.maxHp;
    player.combat.isAlive = true;
    player.moveTo(spawnPosition.x, spawnPosition.y);

    await PlayerFactory.save(player);

    // Emit player respawn event
    const dbPlayer = await this.prisma.player.findUnique({
      where: { id: player.id },
    });
    if (dbPlayer) {
      await EventBus.emit({
        eventType: 'player:respawn',
        player: dbPlayer,
        x: spawnPosition.x,
        y: spawnPosition.y,
        timestamp: new Date(),
      });
    }
    this.logger.log(
      `🏥 Player ${player.name} respawned at (${spawnPosition.x}, ${spawnPosition.y})`,
    );

    return player;
  }

  async deletePlayer(slackId: string): Promise<PlayerEntity> {
    const player = await this.getPlayer(slackId);
    await PlayerFactory.delete(player.id);
    return player;
  }

  async getPlayersAtLocation(
    x: number,
    y: number,
    excludeSlackId?: string,
  ): Promise<PlayerEntity[]> {
    return PlayerFactory.loadAtLocation(x, y, {
      excludeSlackId,
      aliveOnly: true,
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
    const nearby = await PlayerFactory.loadNearby(currentX, currentY, {
      radius,
      limit,
      excludeSlackId,
      aliveOnly: true,
    });

    return nearby.map((item) => ({
      distance: Math.round(item.distance * 10) / 10,
      direction: item.direction,
      x: item.player.position.x,
      y: item.player.position.y,
    }));
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
    const existingPlayers = await PlayerFactory.loadAll();
    const alivePlayerPositions = existingPlayers
      .filter((p) => p.combat.isAlive)
      .map((p) => ({ x: p.position.x, y: p.position.y }));

    // If no existing players, use preferred position or origin
    if (alivePlayerPositions.length === 0) {
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
      const isValidPosition = alivePlayerPositions.every((existing) => {
        const distance = Math.sqrt(
          Math.pow(candidateX - existing.x, 2) +
            Math.pow(candidateY - existing.y, 2),
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
        ...alivePlayerPositions.map((pos) =>
          Math.sqrt(
            Math.pow(candidateX - pos.x, 2) + Math.pow(candidateY - pos.y, 2),
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
    const maxHp = 80 + health * this.BASE_HP_PER_HEALTH_POINT;

    return { strength, agility, health, maxHp };
  }

  private async findRespawnPositionNearPlayers(
    respawningPlayerSlackId: string,
  ): Promise<{ x: number; y: number }> {
    const RESPAWN_DISTANCE = 100; // Distance from other players to respawn
    const MAX_ATTEMPTS = 50;

    // Get all living players except the one being respawned
    const allPlayers = await PlayerFactory.loadAll();
    const livingPlayers = allPlayers
      .filter(
        (p) =>
          p.combat.isAlive &&
          !(p.clientId === respawningPlayerSlackId && p.clientType === 'slack'),
      )
      .map((p) => ({ x: p.position.x, y: p.position.y }));

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
