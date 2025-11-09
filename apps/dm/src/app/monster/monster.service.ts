import { Injectable } from '@nestjs/common';
import { getPrismaClient, Monster } from '@mud/database';
import { EventBus } from '@mud/engine';
import { WorldService } from '../world/world.service';
import {
  getMonsterTemplate,
  MONSTER_TEMPLATES,
  pickTypeForBiome,
} from './monster.types';
import { isWaterBiome } from '../shared/biome.util';

@Injectable()
export class MonsterService {
  private prisma = getPrismaClient();

  constructor(private worldService: WorldService) {}

  async spawnMonster(
    x: number,
    y: number,
    biomeIdentifier: number,
  ): Promise<Monster> {
    const tile = await this.worldService.getTileInfo(x, y);
    if (isWaterBiome(tile.biomeName)) {
      throw new Error('Cannot spawn monsters in water.');
    }

    const biomeId = tile.biomeId ?? biomeIdentifier;

    // Use provided template or pick a random one
    const monsterTemplate =
      MONSTER_TEMPLATES[Math.floor(Math.random() * MONSTER_TEMPLATES.length)];

    return this.createMonster(x, y, biomeId, monsterTemplate);
  }

  async getAllMonsters(): Promise<Monster[]> {
    return this.prisma.monster.findMany();
  }

  async getMonstersAtLocation(x: number, y: number): Promise<Monster[]> {
    return this.prisma.monster.findMany({
      where: {
        x,
        y,
      },
    });
  }

  async getMonstersInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<Monster[]> {
    return this.prisma.monster.findMany({
      where: {
        x: {
          gte: minX,
          lte: maxX,
        },
        y: {
          gte: minY,
          lte: maxY,
        },
      },
    });
  }

  async findNearestMonsterWithinRadius(
    x: number,
    y: number,
    radius: number,
  ): Promise<{ monster: Monster; distance: number } | null> {
    if (!Number.isFinite(radius) || radius <= 0) {
      return null;
    }

    const searchRadius = Math.max(1, Math.ceil(radius));
    const monsters = await this.getMonstersInBounds(
      x - searchRadius,
      x + searchRadius,
      y - searchRadius,
      y + searchRadius,
    );

    let closest: { monster: Monster; distance: number } | null = null;

    for (const monster of monsters) {
      const dx = monster.x - x;
      const dy = monster.y - y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius) {
        continue;
      }
      if (!closest || distance < closest.distance) {
        closest = { monster, distance };
      }
    }

    return closest;
  }

  async moveMonster(monsterId: number): Promise<Monster> {
    const entity = await this.prisma.monster.findUnique({
      where: { id: monsterId },
    });

    if (!entity) {
      throw new Error('Monster not found or not alive');
    }

    const fromX = entity.x;
    const fromY = entity.y;
    // Random movement (50% chance to move)
    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 0, dy: 1 }, // South
      { dx: 1, dy: 0 }, // East
      { dx: -1, dy: 0 }, // West
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];
    const newX = entity.x + direction.dx;
    const newY = entity.y + direction.dy;

    const targetTile = await this.worldService.getTileInfo(newX, newY);
    if (isWaterBiome(targetTile.biomeName)) {
      // Just update last move timestamp
      entity.lastMove = new Date();
      await this.prisma.monster.update({
        where: { id: entity.id },
        data: { lastMove: entity.lastMove },
      });
    } else {
      // Move to new position
      entity.x = newX;
      entity.y = newY;
      entity.lastMove = new Date();
      await this.prisma.monster.update({
        where: { id: entity.id },
        data: entity,
      });

      const dbMonster = await this.prisma.monster.findUnique({
        where: { id: entity.id },
      });

      if (dbMonster && (fromX !== dbMonster.x || fromY !== dbMonster.y)) {
        await EventBus.emit({
          eventType: 'monster:move',
          monster: dbMonster,
          fromX,
          fromY,
          toX: dbMonster.x,
          toY: dbMonster.y,
          timestamp: new Date(),
        });
      }
    }

    return entity;
  }

  async damageMonster(monsterId: number, damage: number): Promise<Monster> {
    const entity = await this.prisma.monster.findUnique({
      where: { id: monsterId },
    });

    if (!entity) {
      throw new Error('Monster not found or not alive');
    }

    // Use entity's takeDamage method
    const wasAlive = entity.isAlive;

    const actualDamage = Math.max(0, damage);
    entity.hp = Math.max(0, entity.hp - actualDamage);

    if (entity.hp === 0) {
      entity.isAlive = false;
    }

    await this.prisma.monster.update({
      where: { id: entity.id },
      data: entity,
    });

    if (wasAlive && !entity.isAlive) {
      const dbMonster = await this.prisma.monster.findUnique({
        where: { id: entity.id },
      });

      const monsterForEvent: Monster = dbMonster ?? {
        id: entity.id,
        name: entity.name,
        type: entity.type,
        hp: entity.hp,
        maxHp: entity.maxHp,
        strength: entity.strength,
        agility: entity.agility,
        health: entity.health,
        x: entity.x,
        y: entity.y,
        isAlive: entity.isAlive,
        lastMove: entity.lastMove,
        spawnedAt: entity.spawnedAt,
        biomeId: entity.biomeId,
        createdAt: entity.spawnedAt,
        updatedAt: new Date(),
      };

      await EventBus.emit({
        eventType: 'monster:death',
        monster: monsterForEvent,
        x: monsterForEvent.x,
        y: monsterForEvent.y,
        timestamp: new Date(),
      });
    }

    return entity;
  }

  async cleanupDeadMonsters(): Promise<void> {
    // Remove monsters that have been dead for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    await this.prisma.monster.deleteMany({
      where: {
        isAlive: false,
        updatedAt: {
          lt: oneHourAgo,
        },
      },
    });
  }

  async spawnMonstersInArea(
    centerX: number,
    centerY: number,
    radius = 5,
    constraints?: { avoidSettlementsWithin?: number; maxGroupSize?: number },
  ): Promise<Monster[]> {
    const monsters: Monster[] = [];
    const groupCap = constraints?.maxGroupSize ?? 3;
    const spawnCount = Math.max(
      1,
      Math.min(groupCap, Math.floor(Math.random() * groupCap) + 1),
    );

    for (let i = 0; i < spawnCount; i++) {
      // Random position within radius
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * radius;
      const x = Math.floor(centerX + Math.cos(angle) * distance);
      const y = Math.floor(centerY + Math.sin(angle) * distance);

      // Fetch tile and nearby from world to decide biome and safety
      const center = await this.worldService.getTileInfoWithNearby(x, y);

      if (isWaterBiome(center.tile.biomeName)) {
        continue;
      }

      // settlement avoidance
      const avoidR = constraints?.avoidSettlementsWithin ?? 3;
      const tooCloseToSettlement =
        (center.currentSettlement && center.currentSettlement.intensity > 0) ||
        center.nearbySettlements?.some((s) => {
          const dx = Math.abs(s.x - x);
          const dy = Math.abs(s.y - y);
          return dx <= avoidR && dy <= avoidR;
        });
      if (tooCloseToSettlement) continue;

      // Weighted biome spawn selection from centralized table
      const chosenType = pickTypeForBiome(center.tile.biomeName);

      // Map name->stats by cloning from template with variance via spawnMonster
      const biomeId = center.tile.biomeId;
      const m = await this.spawnMonsterWithType(x, y, biomeId, chosenType);
      monsters.push(m);
    }

    return monsters;
  }

  private async spawnMonsterWithType(
    x: number,
    y: number,
    biomeId: number,
    type: string,
  ): Promise<Monster> {
    // Get template matching type from centralized table
    const template = getMonsterTemplate(type);

    return this.createMonster(x, y, biomeId, template);
  }

  private async createMonster(
    x: number,
    y: number,
    biomeId: number,
    monsterTemplate: (typeof MONSTER_TEMPLATES)[0],
  ): Promise<Monster> {
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
        biomeId: biomeId,
        isAlive: true,
      },
    });

    // Emit spawn event
    await EventBus.emit({
      eventType: 'monster:spawn',
      monster,
      x,
      y,
      timestamp: new Date(),
    });

    return monster;
  }
}
