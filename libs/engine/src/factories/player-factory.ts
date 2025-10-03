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
   */
  static async loadByName(
    name: string,
    clientType: ClientType,
  ): Promise<PlayerEntity | null> {
    const player = await this.prisma.player.findFirst({
      where: { name },
    });

    if (!player) {
      return null;
    }

    return this.fromDatabaseModel(player, clientType);
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
