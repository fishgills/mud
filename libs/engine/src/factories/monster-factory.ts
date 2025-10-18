/**
 * Monster Factory - Creates and manages monster entities
 * Inspired by RanvierMUD's factory pattern
 */

import { getPrismaClient, Monster } from '@mud/database';
import { MonsterEntity } from '../entities/monster-entity.js';
import { EventBus } from '../events/index.js';

export interface MonsterTemplate {
  name: string;
  type: string;
  baseHp: number;
  strength: number;
  agility: number;
  health: number;
}

// Default monster templates
export const MONSTER_TEMPLATES: MonsterTemplate[] = [
  {
    name: 'Goblin',
    type: 'humanoid',
    baseHp: 20,
    strength: 8,
    agility: 12,
    health: 8,
  },
  {
    name: 'Wolf',
    type: 'beast',
    baseHp: 25,
    strength: 12,
    agility: 14,
    health: 10,
  },
  {
    name: 'Skeleton',
    type: 'undead',
    baseHp: 30,
    strength: 10,
    agility: 10,
    health: 12,
  },
  {
    name: 'Orc',
    type: 'humanoid',
    baseHp: 40,
    strength: 14,
    agility: 8,
    health: 14,
  },
  {
    name: 'Giant Spider',
    type: 'beast',
    baseHp: 35,
    strength: 11,
    agility: 15,
    health: 11,
  },
  {
    name: 'Troll',
    type: 'giant',
    baseHp: 60,
    strength: 16,
    agility: 6,
    health: 16,
  },
];

export interface CreateMonsterOptions {
  x: number;
  y: number;
  biomeId: number;
  template?: MonsterTemplate;
}

export class MonsterFactory {
  private static prisma = getPrismaClient();

  /**
   * Create a new monster in the database and return a MonsterEntity
   */
  static async create(options: CreateMonsterOptions): Promise<MonsterEntity> {
    const { x, y, biomeId, template } = options;

    // Use provided template or pick a random one
    const monsterTemplate =
      template ||
      MONSTER_TEMPLATES[Math.floor(Math.random() * MONSTER_TEMPLATES.length)];

    // Add variance to stats (±2)
    const variance = () => Math.floor(Math.random() * 5) - 2;

    const strength = Math.max(1, monsterTemplate.strength + variance());
    const agility = Math.max(1, monsterTemplate.agility + variance());
    const health = Math.max(1, monsterTemplate.health + variance());
    const maxHp = monsterTemplate.baseHp + health * 2;

    const monster = await this.prisma.monster.create({
      data: {
        name: monsterTemplate.name,
        type: monsterTemplate.type,
        hp: maxHp,
        maxHp,
        strength,
        agility,
        health,
        x,
        y,
        biomeId,
        isAlive: true,
      },
    });

    const entity = this.fromDatabaseModel(monster);

    // Emit spawn event
    await EventBus.emit({
      eventType: 'monster:spawn',
      monster,
      x,
      y,
      timestamp: new Date(),
    });

    return entity;
  }

  /**
   * Load a monster from the database by ID
   */
  static async load(id: number): Promise<MonsterEntity | null> {
    const monster = await this.prisma.monster.findUnique({
      where: { id },
    });

    if (!monster) {
      return null;
    }

    return this.fromDatabaseModel(monster);
  }

  /**
   * Load all monsters at a location
   */
  static async loadAtLocation(x: number, y: number): Promise<MonsterEntity[]> {
    const monsters = await this.prisma.monster.findMany({
      where: { x, y, isAlive: true },
    });

    return monsters.map((m) => this.fromDatabaseModel(m));
  }

  /**
   * Load all alive monsters
   */
  static async loadAll(): Promise<MonsterEntity[]> {
    const monsters = await this.prisma.monster.findMany({
      where: { isAlive: true },
    });

    return monsters.map((m) => this.fromDatabaseModel(m));
  }

  /**
   * Load all monsters within bounds
   */
  static async loadInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<MonsterEntity[]> {
    const monsters = await this.prisma.monster.findMany({
      where: {
        isAlive: true,
        x: { gte: minX, lte: maxX },
        y: { gte: minY, lte: maxY },
      },
    });

    return monsters.map((m) => this.fromDatabaseModel(m));
  }

  /**
   * Save a monster entity to the database
   */
  static async save(entity: MonsterEntity): Promise<void> {
    await this.prisma.monster.update({
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
        isAlive: entity.combat.isAlive,
        lastMove: entity.lastMove,
      },
    });
  }

  /**
   * Delete a monster from the database
   */
  static async delete(
    id: number,
    options?: { killedBy?: { type: 'player' | 'monster'; id?: number } },
  ): Promise<void> {
    const monster = await this.prisma.monster.findUnique({
      where: { id },
    });

    await this.prisma.monster.delete({
      where: { id },
    });

    if (monster) {
      await EventBus.emit({
        eventType: 'monster:death',
        monster,
        killedBy: options?.killedBy,
        x: monster.x,
        y: monster.y,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Delete monsters matching criteria (for cleanup operations)
   */
  static async deleteMany(where: {
    isAlive?: boolean;
    updatedAt?: { lt: Date };
  }): Promise<number> {
    const result = await this.prisma.monster.deleteMany({ where });
    return result.count;
  }

  /**
   * Convert database model to MonsterEntity
   */
  static fromDatabaseModel(monster: Monster): MonsterEntity {
    return new MonsterEntity({
      id: monster.id,
      name: monster.name,
      type: monster.type,
      attributes: {
        strength: monster.strength,
        agility: monster.agility,
        health: monster.health,
      },
      combat: {
        hp: monster.hp,
        maxHp: monster.maxHp,
        isAlive: monster.isAlive,
      },
      position: {
        x: monster.x,
        y: monster.y,
      },
      biomeId: monster.biomeId,
      spawnedAt: monster.spawnedAt,
    });
  }

  /**
   * Get a random monster template
   */
  static getRandomTemplate(): MonsterTemplate {
    return MONSTER_TEMPLATES[
      Math.floor(Math.random() * MONSTER_TEMPLATES.length)
    ];
  }

  /**
   * Get a template by name
   */
  static getTemplateByName(name: string): MonsterTemplate | undefined {
    return MONSTER_TEMPLATES.find(
      (t) => t.name.toLowerCase() === name.toLowerCase(),
    );
  }
}
