import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import {
  getPrismaClient,
  findPlayerBySlackUser,
  Player,
  Prisma,
} from '@mud/database';
import { EventBus, type PlayerRespawnEvent } from '../../shared/event-bus';
import {
  CreatePlayerDto,
  MovePlayerDto,
  PlayerStatsDto,
} from './dto/player.dto';
import { WorldService } from '../world/world.service';
import { isWaterBiome } from '../shared/biome.util';
import { DiceRoll } from '@dice-roller/rpg-dice-roller';

@Injectable()
export class PlayerService {
  private readonly logger = new Logger(PlayerService.name);
  private prisma = getPrismaClient();

  private readonly SKILL_POINT_INTERVAL = 4;
  private readonly SKILL_POINTS_PER_INTERVAL = 2;
  private readonly HIT_DIE_AVERAGE = 6; // Average roll for a d10

  constructor(private readonly worldService: WorldService) {}

  /**
   * Get top players by level and XP, optionally filtered by team/workspace
   */
  async getTopPlayers(limit = 10, teamId?: string) {
    const whereClause = teamId
      ? {
          slackUser: {
            teamId: teamId,
          },
        }
      : {};

    const players = await this.prisma.player.findMany({
      where: whereClause,
      orderBy: [{ level: 'desc' }, { xp: 'desc' }],
      take: limit,
    });

    return players;
  }

  // Returns the cumulative XP threshold required to reach the next level.
  // Uses a triangular progression that grows with level:
  // T(level) = base * (level * (level + 1) / 2)
  // Examples (base=100): L1->2: 100, L2->3: 300, L3->4: 600, L4->5: 1000
  private getXpForNextLevel(level: number): number {
    const BASE = 100;
    return Math.floor((BASE * (level * (level + 1))) / 2);
  }

  private getStatModifier(stat: number): number {
    return Math.floor((stat - 10) / 2);
  }

  private calculateLevelUpHpGain(health: number): number {
    const roll = new DiceRoll('1d10');
    const modifier = this.getStatModifier(health);
    return Math.max(1, roll.total + modifier);
  }

  async createPlayer(createPlayerDto: CreatePlayerDto): Promise<Player> {
    const { teamId, userId, name, x, y } = createPlayerDto;

    // Validate that we have either userId or teamId
    if (!userId || !teamId) {
      throw new BadRequestException('Either userId or teamId must be provided');
    }

    // Check if player already exists (without throwing)
    let existing: Player | undefined;
    try {
      existing = await this.getPlayer(teamId, userId);
    } catch (err) {
      // Player doesn't exist yet, which is expected for new players
      existing = undefined;
    }

    if (existing) {
      throw new ConflictException('Player already exists');
    }

    const stats = this.generateRandomStats();

    // Find a spawn position
    const spawnPosition = await this.findValidSpawnPosition(x, y);

    // Use PlayerFactory to create and return the player entity

    const player = await this.prisma.player.create({
      data: {
        name,
        x: spawnPosition.x ?? 0,
        y: spawnPosition.y ?? 0,
        hp: stats.maxHp,
        maxHp: stats.maxHp,
        strength: stats.strength,
        agility: stats.agility,
        health: stats.health,
        level: 1,
        skillPoints: 0,
        gold: 0,
        xp: 0,
        isAlive: true,
      },
    });
    await this.prisma.slackUser.create({
      data: {
        teamId,
        userId,
        playerId: player.id,
      },
    });
    // PlayerFactory already emits player:spawn event, no need to emit again
    this.logger.log(
      `✅ Player created: ${player.name} at (${player.x}, ${player.y}) for teamId=${teamId}, userId=${userId}`,
    );

    return player;
  }

  async getPlayer(teamId: string, userId: string): Promise<Player> {
    this.logger.debug(
      `Looking up player for teamId=${teamId}, userId=${userId}`,
    );
    const player = await findPlayerBySlackUser({ userId, teamId });
    if (!player) {
      this.logger.warn(
        `Player not found for teamId=${teamId}, userId=${userId}`,
      );
      throw new NotFoundException('Player not found');
    }
    return player;
  }

  async getAllPlayers(): Promise<Player[]> {
    return this.prisma.player.findMany();
  }

  /**
   * Update the lastAction timestamp for a player (used for activity tracking)
   * @param teamId The team ID of the player
   */
  async updateLastAction(playerId: number): Promise<void> {
    await this.prisma.player.update({
      where: {
        id: playerId,
      },
      data: {
        lastAction: new Date(),
      },
    });
  }

  /**
   * Check if there are any players who have been active within the specified time window
   * @param minutesThreshold How many minutes back to check for activity (default: 30)
   * @returns true if any players have been active within the threshold
   */
  async hasActivePlayers(minutesThreshold: number = 30): Promise<boolean> {
    const count = await this.prisma.player.count({
      where: {
        lastAction: {
          gte: new Date(Date.now() - minutesThreshold * 60 * 1000),
        },
      },
    });

    return count > 0;
  }

  async movePlayer(
    teamId: string,
    userId: string,
    moveDto: MovePlayerDto,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    const oldX = player.x;
    const oldY = player.y;

    // Debug logging
    this.logger.debug(
      `Player: ${player.name}, Current: (${oldX}, ${oldY}), MoveDto: ${JSON.stringify(moveDto)}`,
    );

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
      const requestedDistance = moveDto.distance ?? 1;
      if (!Number.isInteger(requestedDistance) || requestedDistance < 1) {
        throw new Error('Distance must be a positive whole number.');
      }
      const agility = player.agility ?? 0;
      const maxDistance = Math.max(1, agility);
      if (requestedDistance > maxDistance) {
        const spaceLabel = maxDistance === 1 ? 'space' : 'spaces';
        throw new Error(
          `You can move up to ${maxDistance} ${spaceLabel} based on your agility.`,
        );
      }
      switch (moveDto.direction.toLowerCase()) {
        case 'n':
        case 'north':
          newY += requestedDistance;
          break;
        case 's':
        case 'south':
          newY -= requestedDistance;
          break;
        case 'e':
        case 'east':
          newX += requestedDistance;
          break;
        case 'w':
        case 'west':
          newX -= requestedDistance;
          break;
        default:
          throw new Error('Invalid direction. Use n, s, e, w');
      }

      this.logger.debug(
        `[MOVE-DEBUG] After direction calc: direction=${moveDto.direction}, distance=${requestedDistance}, newPos=(${newX}, ${newY})`,
      );
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

    player.x = newX;
    player.y = newY;

    await this.prisma.player.update({
      where: { id: player.id },
      data: { x: newX, y: newY },
    });

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
    teamId: string,
    userId: string,
    statsDto: PlayerStatsDto,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    const previousSkillPoints = player.skillPoints;

    // Handle character creation completion
    if (statsDto.completeCreation) {
      if (player.isCreationComplete) {
        throw new BadRequestException(
          'Character creation is already complete.',
        );
      }
      player.isCreationComplete = true;
    }

    if (typeof statsDto.hp === 'number') {
      player.hp = statsDto.hp;
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

        const hpGain = this.calculateLevelUpHpGain(player.health);
        player.maxHp += hpGain;
        player.hp = Math.min(player.hp + hpGain, player.maxHp);

        if (player.level % this.SKILL_POINT_INTERVAL === 0) {
          player.skillPoints += this.SKILL_POINTS_PER_INTERVAL;
        }
      }
    }

    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        xp: player.xp,
        level: player.level,
        maxHp: player.maxHp,
        hp: player.hp,
        skillPoints: player.skillPoints,
        isCreationComplete: player.isCreationComplete,
        gold: player.gold,
        agility: player.agility,
        strength: player.strength,
      },
    });

    if (leveledUp) {
      this.logger.log(
        `🎉 ${player.name} advanced ${levelsGained} level(s) to ${player.level}! Max HP is now ${player.maxHp}.`,
      );

      const dbPlayer = await this.prisma.player.findUnique({
        where: { id: player.id },
      });

      if (dbPlayer) {
        const skillPointsAwarded = Math.max(
          0,
          player.skillPoints - previousSkillPoints,
        );
        await EventBus.emit({
          eventType: 'player:levelup',
          player: dbPlayer,
          newLevel: player.level,
          skillPointsGained: skillPointsAwarded,
          timestamp: new Date(),
        });
      }
    }

    return player;
  }

  async spendSkillPoint(
    teamId: string,
    userId: string,
    attribute: 'strength' | 'agility' | 'health',
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);

    if (player.skillPoints <= 0) {
      throw new Error('No skill points available.');
    }

    if (player[attribute] >= 20) {
      throw new Error(`Cannot increase ${attribute} beyond 20.`);
    }

    player[attribute] += 1;
    player.skillPoints -= 1;

    if (attribute === 'health') {
      player.maxHp = player.maxHp + this.calculateLevelUpHpGain(player.health);
    }

    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        strength: player.strength,
        agility: player.agility,
        health: player.health,
        maxHp: player.maxHp,
        skillPoints: player.skillPoints,
      },
    });

    const newAttributeValue = player[attribute];
    const remainingSkillPoints = player.skillPoints;

    this.logger.log(
      `⚔️ ${player.name} increased ${attribute} to ${newAttributeValue}. Remaining skill points: ${remainingSkillPoints}.`,
    );

    return player;
  }

  async rerollPlayerStats(teamId: string, userId: string): Promise<Player> {
    const currentPlayer = await this.getPlayer(teamId, userId);

    // Prevent rerolling if character creation is already complete
    if (currentPlayer.isCreationComplete) {
      throw new BadRequestException(
        'Character creation is complete. You cannot reroll anymore.',
      );
    }

    // Generate new random starting stats
    const { strength, agility, health, maxHp } = this.generateRandomStats();

    // Update entity attributes
    currentPlayer.strength = strength;
    currentPlayer.agility = agility;
    currentPlayer.health = health;
    currentPlayer.maxHp = maxHp;

    // Set HP to new maxHp during reroll
    currentPlayer.hp = maxHp;

    await this.prisma.player.update({
      where: { id: currentPlayer.id },
      data: {
        strength,
        agility,
        health,
        maxHp,
        hp: maxHp,
      },
    });

    return this.getPlayer(teamId, userId);
  }

  async healPlayer(
    teamId: string,
    userId: string,
    amount: number,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    player.hp = Math.min(player.hp + amount, player.maxHp);
    await this.prisma.player.update({
      where: { id: player.id },
      data: { hp: player.hp },
    });
    return player;
  }

  async damagePlayer(
    teamId: string,
    userId: string,
    damage: number,
  ): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    const wasAlive = player.isAlive;
    player.hp = player.hp - damage;
    await this.prisma.player.update({
      where: { id: player.id },
      data: { hp: player.hp },
    });

    // Emit player death event if they died from this damage
    if (wasAlive && !player.isAlive) {
      const dbPlayer = await this.prisma.player.findUnique({
        where: { id: player.id },
      });
      if (dbPlayer) {
        await EventBus.emit({
          eventType: 'player:death',
          player: dbPlayer,
          x: dbPlayer.x,
          y: dbPlayer.y,
          timestamp: new Date(),
        });
      }
      this.logger.log(
        `💀 Player ${player.name} has died at (${player.x}, ${player.y})`,
      );
    }

    return player;
  }

  async restorePlayerHealth(teamId: string, userId: string): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);
    player.hp = player.maxHp;
    player.isAlive = true;
    await this.prisma.player.update({
      where: { id: player.id },
      data: { hp: player.hp, isAlive: true },
    });
    return player;
  }

  async respawnPlayer(teamId: string, userId: string): Promise<Player> {
    const player = await this.getPlayer(teamId, userId);

    // Find a random spawn position
    const spawnPosition = await this.findValidSpawnPosition();

    // Reset player state
    player.hp = player.maxHp;
    player.isAlive = true;
    await this.prisma.player.update({
      where: { id: player.id },
      data: {
        hp: player.hp,
        isAlive: true,
        x: spawnPosition.x,
        y: spawnPosition.y,
      },
    });

    // Emit player respawn event
    const dbPlayer = await this.prisma.player.findUnique({
      where: { id: player.id },
      include: {
        slackUser: true,
      },
    });
    let respawnEvent: PlayerRespawnEvent | null = null;
    if (dbPlayer) {
      respawnEvent = {
        eventType: 'player:respawn',
        player: dbPlayer,
        x: spawnPosition.x,
        y: spawnPosition.y,
        timestamp: new Date(),
      };
      await EventBus.emit(respawnEvent);
    }
    this.logger.log(
      `🏥 Player ${player.name} respawned at (${spawnPosition.x}, ${spawnPosition.y})`,
    );

    return player;
  }

  async deletePlayer(teamId: string, userId: string): Promise<Player> {
    const player = await this.prisma.slackUser.delete({
      where: {
        teamId_userId: {
          teamId,
          userId,
        },
      },
      include: {
        player: true,
      },
    });
    return player.player;
  }

  async getPlayersAtLocation(
    x: number,
    y: number,
    options?: { excludePlayerId?: number; aliveOnly?: boolean },
  ): Promise<(Player & Prisma.SlackUserInclude)[]> {
    const players = await this.prisma.player.findMany({
      where: {
        x,
        y,
        isAlive: options?.aliveOnly ?? true,
        NOT: {
          id: options?.excludePlayerId,
        },
      },
      include: {
        slackUser: true,
      },
    });
    return players;
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
    x: number,
    y: number,
    teamId: string,
    userId: string,
    radius = Infinity,
    limit = 10,
  ): Promise<
    Array<{ distance: number; direction: string; x: number; y: number }>
  > {
    // const player = await this.getPlayer(teamId, userId);
    const whereClause: {
      isAlive?: boolean;
      AND?: Array<Record<string, unknown>>;
      x?: { gte: number; lte: number };
      y?: { gte: number; lte: number };
    } = {};

    whereClause.isAlive = true;

    // const normalizedExclude = normalizeSlackId(options.excludeSlackId);
    // const variants = new Set<string>();
    // if (normalizedExclude) {
    //   variants.add(normalizedExclude);
    //   variants.add(`slack:${normalizedExclude}`);
    // }
    // variants.add(options.excludeSlackId);

    // const nots: Array<Record<string, unknown>> = Array.from(variants).map(
    //   (v) => ({ clientId: v }),
    // );
    // if (normalizedExclude) {
    //   nots.push({ clientId: { endsWith: `:${normalizedExclude}` } });
    // }
    // whereClause.AND = [{ clientType: 'slack' }, { NOT: nots }];

    // Use bounding box if radius is finite
    if (radius !== Infinity) {
      whereClause.x = { gte: x - radius, lte: x + radius };
      whereClause.y = { gte: y - radius, lte: y + radius };
    }

    const players = await this.prisma.player.findMany({
      where: whereClause,
      include: { playerItems: { include: { item: true } } },
    });

    // Calculate distances and filter by actual radius
    const nearby = players
      .map((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Calculate direction
        let direction = '';
        if (dy > 0) direction += 'north';
        else if (dy < 0) direction += 'south';
        if (dx > 0) direction += 'east';
        else if (dx < 0) direction += 'west';

        return {
          player: p,
          distance,
          direction: direction || 'here',
          x: p.x,
          y: p.y,
        };
      })
      .filter((p) => p.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return nearby.map((item) => ({
      distance: Math.round(item.distance * 10) / 10,
      direction: item.direction,
      x: item.player.x,
      y: item.player.y,
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
    const existingPlayers = await this.prisma.player.findMany({
      where: { isAlive: true },
    });

    const alivePlayerPositions = existingPlayers.map((p) => ({
      x: p.x,
      y: p.y,
    }));

    // If no existing players, use preferred position or origin
    if (alivePlayerPositions.length === 0) {
      return {
        x: preferredX ?? 0,
        y: preferredY ?? 0,
      };
    }

    // Try to find a valid spawn position on land (avoid water)
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
        try {
          const tile = await this.worldService.getTileInfo(
            candidateX,
            candidateY,
          );
          if (!isWaterBiome(tile.biomeName)) {
            return { x: candidateX, y: candidateY };
          }
        } catch (error) {
          // If world service fails, conservatively skip this candidate but log detail for troubleshooting
          const reason = error instanceof Error ? error.message : `${error}`;
          this.logger.warn(
            `Skipping spawn candidate due to tile lookup failure at (${candidateX}, ${candidateY}): ${reason}`,
          );
        }
      }
    }

    // If we couldn't find a valid land position after MAX_ATTEMPTS,
    // find the land position that's farthest from the nearest player
    let bestPosition: { x: number; y: number } | null = null;
    let maxMinDistance = 0;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * SEARCH_RADIUS;
      const candidateX = Math.floor(Math.cos(angle) * distance);
      const candidateY = Math.floor(Math.sin(angle) * distance);

      try {
        const tile = await this.worldService.getTileInfo(
          candidateX,
          candidateY,
        );
        if (isWaterBiome(tile.biomeName)) {
          continue; // skip water tiles
        }

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
      } catch (error) {
        // Skip candidates we can't validate but record why in debug logs
        const reason = error instanceof Error ? error.message : `${error}`;
        this.logger.debug(
          `Failed to validate spawn candidate at (${candidateX}, ${candidateY}): ${reason}`,
        );
        continue;
      }
    }

    if (bestPosition) {
      return bestPosition;
    }

    // As a final fallback, search locally around origin for first non-water tile
    const fallback = await this.findNearestNonWater(0, 0, 25);
    return fallback ?? { x: 0, y: 0 };
  }

  private async findNearestNonWater(
    centerX: number,
    centerY: number,
    maxRadius = 25,
  ): Promise<{ x: number; y: number } | null> {
    for (let r = 0; r <= maxRadius; r++) {
      // Scan the square ring at radius r
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; // only ring cells
          const x = centerX + dx;
          const y = centerY + dy;
          try {
            const tile = await this.worldService.getTileInfo(x, y);
            if (!isWaterBiome(tile.biomeName)) {
              return { x, y };
            }
          } catch {
            // ignore and continue
          }
        }
      }
    }
    return null;
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
    const strength = new DiceRoll('4d6k3').total;
    const agility = new DiceRoll('4d6k3').total;
    const health = new DiceRoll('4d6k3').total;

    // Calculate starting HP: 10 base + Vitality modifier
    const maxHp = 10 + this.getStatModifier(health);

    return { strength, agility, health, maxHp };
  }

  calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }
}
