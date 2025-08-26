import { Injectable, Logger } from '@nestjs/common';
import { getPrismaClient, Monster } from '@mud/database';
import { WorldService } from '../world/world.service';
import {
  MONSTER_TEMPLATES,
  getMonsterTemplate,
  pickTypeForBiome,
} from './monster.types';

@Injectable()
export class MonsterService {
  private prisma = getPrismaClient();
  constructor(private worldService: WorldService) {}

  async spawnMonster(x: number, y: number, biomeId: number): Promise<Monster> {
    // Choose a random template from the global set
    const monsterTemplate =
      MONSTER_TEMPLATES[Math.floor(Math.random() * MONSTER_TEMPLATES.length)];

    // Add some randomness to stats (±2)
    const variance = () => Math.floor(Math.random() * 5) - 2;

    const strength = Math.max(1, monsterTemplate.strength + variance());
    const agility = Math.max(1, monsterTemplate.agility + variance());
    const health = Math.max(1, monsterTemplate.health + variance());
    const maxHp = monsterTemplate.baseHp + health * 2;

    return this.prisma.monster.create({
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
  }

  async getAllMonsters(): Promise<Monster[]> {
    return this.prisma.monster.findMany({
      where: { isAlive: true },
      include: {
        biome: true,
      },
    });
  }

  async getMonstersAtLocation(x: number, y: number): Promise<Monster[]> {
    return this.prisma.monster.findMany({
      where: {
        x,
        y,
        isAlive: true,
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
        isAlive: true,
        x: { gte: minX, lte: maxX },
        y: { gte: minY, lte: maxY },
      },
      include: { biome: true },
    });
  }

  async moveMonster(monsterId: number): Promise<Monster> {
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId, isAlive: true },
    });

    if (!monster) {
      throw new Error('Monster not found or not alive');
    }

    // Random movement (50% chance to move)
    const directions = [
      { dx: 0, dy: -1 }, // North
      { dx: 0, dy: 1 }, // South
      { dx: 1, dy: 0 }, // East
      { dx: -1, dy: 0 }, // West
    ];

    const direction = directions[Math.floor(Math.random() * directions.length)];
    const newX = monster.x + direction.dx;
    const newY = monster.y + direction.dy;

    return this.prisma.monster.update({
      where: { id: monsterId },
      data: {
        x: newX,
        y: newY,
        lastMove: new Date(),
      },
    });
  }

  async damageMonster(monsterId: number, damage: number): Promise<Monster> {
    const monster = await this.prisma.monster.findUnique({
      where: { id: monsterId, isAlive: true },
    });

    if (!monster) {
      throw new Error('Monster not found or not alive');
    }

    const newHp = Math.max(monster.hp - damage, 0);
    const isAlive = newHp > 0;

    return this.prisma.monster.update({
      where: { id: monsterId },
      data: {
        hp: newHp,
        isAlive,
      },
    });
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
    // choose template matching type from centralized table
    const template = getMonsterTemplate(type);
    const variance = () => Math.floor(Math.random() * 5) - 2;
    const strength = Math.max(1, template.strength + variance());
    const agility = Math.max(1, template.agility + variance());
    const health = Math.max(1, template.health + variance());
    const maxHp = template.baseHp + health * 2;
    return this.prisma.monster.create({
      data: {
        name: template.name,
        type: template.type,
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
  }
}
