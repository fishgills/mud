/**
 * Player Factory - Creates and manages player entities
 * Inspired by RanvierMUD's factory pattern
 */

import { getPrismaClient, Player } from '@mud/database';

import { PlayerEntity, ClientType } from '../entities/player-entity';
import { EventBus } from '../events';

export interface CreatePlayerOptions {
  clientId: string;
  clientType: ClientType;
  name: string;
  x?: number;
  y?: number;
}

export class PlayerFactory {
  private static prisma = getPrismaClient();

  /**
   * Create a new player in the database and return a PlayerEntity
   */
  static async create(options: CreatePlayerOptions): Promise<PlayerEntity> {
    const { clientId, clientType, name, x, y } = options;

    // Generate random starting stats
    const stats = this.generateRandomStats();

    // Format clientId with type prefix
    const fullClientId = `${clientType}:${clientId}`;

    const player = await this.prisma.player.create({
      data: {
        slackId: clientType === 'slack' ? clientId : undefined, // Keep for backwards compat
        clientId: fullClientId, // New field: "slack:U123" or "discord:456"
        clientType, // New field: "slack", "discord", "web"
        name,
        x: x ?? 0,
        y: y ?? 0,
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

    const entity = this.fromDatabaseModel(player, clientType);

    // Emit spawn event
    await EventBus.emit({
      eventType: 'player:spawn',
      player,
      x: player.x,
      y: player.y,
      timestamp: new Date(),
    });

    return entity;
  }

  /**
   * Load a player from the database by clientId
   * Supports both new format ("slack:U123") and legacy format ("U123")
   */
  static async load(
    clientId: string,
    clientType: ClientType,
  ): Promise<PlayerEntity | null> {
    const fullClientId = `${clientType}:${clientId}`;

    // Try new format first, then fall back to legacy slackId
    const player = await this.prisma.player.findFirst({
      where: {
        OR: [
          { clientId: fullClientId }, // New format: "slack:U123"
          { clientId }, // Handle if already prefixed
          { slackId: clientId }, // Legacy format: "U123"
        ],
      },
    });

    if (!player) {
      return null;
    }

    return this.fromDatabaseModel(player, clientType);
  }

  /**
   * Load a player from the database by name
   * Returns null if no match, or throws error if multiple matches
   */
  static async loadByName(name: string): Promise<PlayerEntity | null> {
    const matches = await this.prisma.player.findMany({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
      orderBy: { id: 'asc' },
    });

    if (matches.length === 0) {
      return null;
    }

    if (matches.length > 1) {
      throw new Error(
        `Multiple players found with the name "${name}". IDs: ${matches.map((p) => p.id).join(', ')}`,
      );
    }

    const player = matches[0];
    const clientType = (player.clientType || 'slack') as ClientType;
    return this.fromDatabaseModel(player, clientType);
  }

  /**
   * Load all players from the database
   */
  static async loadAll(): Promise<PlayerEntity[]> {
    const players = await this.prisma.player.findMany();
    return players.map((p) => {
      const clientType = (p.clientType || 'slack') as ClientType;
      return this.fromDatabaseModel(p, clientType);
    });
  }

  /**
   * Load players at a specific location
   */
  static async loadAtLocation(
    x: number,
    y: number,
    options?: { excludePlayerId?: number; aliveOnly?: boolean },
  ): Promise<PlayerEntity[]> {
    const players = await this.prisma.player.findMany({
      where: {
        x,
        y,
        ...(options?.aliveOnly ? { isAlive: true } : {}),
        ...(options?.excludePlayerId
          ? { id: { not: options.excludePlayerId } }
          : {}),
      },
    });
    return players.map((p) => {
      const clientType = (p.clientType || 'slack') as ClientType;
      return this.fromDatabaseModel(p, clientType);
    });
  }

  /**
   * Load nearby players within a radius
   */
  static async loadNearby(
    x: number,
    y: number,
    options?: {
      radius?: number;
      limit?: number;
      excludeSlackId?: string;
      aliveOnly?: boolean;
    },
  ): Promise<
    Array<{
      player: PlayerEntity;
      distance: number;
      direction: string;
    }>
  > {
    const radius = options?.radius ?? Infinity;
    const limit = options?.limit ?? 10;
    const aliveOnly = options?.aliveOnly ?? true;

    // Build where clause
    const whereClause: {
      isAlive?: boolean;
      slackId?: { not: string };
      x?: { gte: number; lte: number };
      y?: { gte: number; lte: number };
    } = {};

    if (aliveOnly) {
      whereClause.isAlive = true;
    }

    if (options?.excludeSlackId) {
      whereClause.slackId = { not: options.excludeSlackId };
    }

    // Use bounding box if radius is finite
    if (radius !== Infinity) {
      whereClause.x = { gte: x - radius, lte: x + radius };
      whereClause.y = { gte: y - radius, lte: y + radius };
    }

    const players = await this.prisma.player.findMany({
      where: whereClause,
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

        const clientType = (p.clientType || 'slack') as ClientType;
        return {
          player: this.fromDatabaseModel(p, clientType),
          distance,
          direction: direction || 'here',
          x: p.x,
          y: p.y,
        };
      })
      .filter((p) => p.distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return nearby;
  }

  /**
   * Delete a player from the database
   */
  static async delete(playerId: number): Promise<void> {
    await this.prisma.player.delete({
      where: { id: playerId },
    });
  }

  /**
   * Update last action timestamp for a player
   */
  static async updateLastAction(
    clientId: string,
    clientType: ClientType,
  ): Promise<void> {
    const fullClientId = `${clientType}:${clientId}`;

    await this.prisma.player.updateMany({
      where: {
        OR: [{ clientId: fullClientId }, { clientId }, { slackId: clientId }],
      },
      data: { lastAction: new Date() },
    });
  }

  /**
   * Save a player entity to the database
   */
  static async save(entity: PlayerEntity): Promise<void> {
    await this.prisma.player.update({
      where: { id: entity.id },
      data: {
        name: entity.name,
        x: entity.position.x,
        y: entity.position.y,
        hp: entity.combat.hp,
        maxHp: entity.combat.maxHp,
        strength: entity.attributes.strength,
        agility: entity.attributes.agility,
        health: entity.attributes.health,
        gold: entity.gold,
        xp: entity.xp,
        level: entity.level,
        skillPoints: entity.skillPoints,
        isAlive: entity.combat.isAlive,
      },
    });
  }

  /**
   * Convert database model to PlayerEntity
   */
  static fromDatabaseModel(
    player: Player,
    clientType: ClientType,
  ): PlayerEntity {
    // Extract platform ID from clientId if available, otherwise use slackId
    const platformId = player.clientId
      ? player.clientId.split(':')[1] || player.clientId
      : player.slackId || '';

    return new PlayerEntity({
      id: player.id,
      clientId: platformId,
      clientType: (player.clientType as ClientType) || clientType,
      name: player.name,
      attributes: {
        strength: player.strength,
        agility: player.agility,
        health: player.health,
      },
      combat: {
        hp: player.hp,
        maxHp: player.maxHp,
        isAlive: player.isAlive,
      },
      position: {
        x: player.x,
        y: player.y,
      },
      gold: player.gold,
      xp: player.xp,
      level: player.level,
      skillPoints: player.skillPoints,
      partyId: undefined, // TODO: Add when party system is implemented
    });
  }

  /**
   * Count players active within a time threshold
   */
  static async countActivePlayers(minutesThreshold: number): Promise<number> {
    const thresholdDate = new Date(Date.now() - minutesThreshold * 60 * 1000);
    const count = await this.prisma.player.count({
      where: {
        lastAction: {
          gte: thresholdDate,
        },
      },
    });
    return count;
  }

  /**
   * Generate random starting stats for a new player
   */
  private static generateRandomStats(): {
    strength: number;
    agility: number;
    health: number;
    maxHp: number;
  } {
    // Roll 3d6 for each stat (range: 3-18)
    const rollStat = () => {
      return (
        Math.floor(Math.random() * 6) +
        1 +
        Math.floor(Math.random() * 6) +
        1 +
        Math.floor(Math.random() * 6) +
        1
      );
    };

    const strength = rollStat();
    const agility = rollStat();
    const health = rollStat();

    // Calculate starting HP: 10 base + (health * 2)
    const maxHp = 10 + health * 2;

    return { strength, agility, health, maxHp };
  }
}
