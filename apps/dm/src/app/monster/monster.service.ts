import { Injectable } from '@nestjs/common';
import { getPrismaClient, Monster } from '@mud/database';

@Injectable()
export class MonsterService {
  private prisma = getPrismaClient();

  // Monster types with different stat ranges
  private monsterTypes = [
    {
      name: 'Goblin',
      type: 'goblin',
      baseHp: 25,
      strength: 6,
      agility: 12,
      health: 6,
    },
    {
      name: 'Orc',
      type: 'orc',
      baseHp: 40,
      strength: 12,
      agility: 8,
      health: 10,
    },
    {
      name: 'Wolf',
      type: 'wolf',
      baseHp: 30,
      strength: 10,
      agility: 14,
      health: 8,
    },
    {
      name: 'Bear',
      type: 'bear',
      baseHp: 60,
      strength: 16,
      agility: 6,
      health: 14,
    },
    {
      name: 'Skeleton',
      type: 'skeleton',
      baseHp: 20,
      strength: 8,
      agility: 10,
      health: 6,
    },
  ];

  async spawnMonster(x: number, y: number, biomeId: number): Promise<Monster> {
    const monsterTemplate =
      this.monsterTypes[Math.floor(Math.random() * this.monsterTypes.length)];

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
        worldTile: true,
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
      include: {
        biome: true,
      },
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
    if (Math.random() < 0.5) {
      const directions = [
        { dx: 0, dy: -1 }, // North
        { dx: 0, dy: 1 }, // South
        { dx: 1, dy: 0 }, // East
        { dx: -1, dy: 0 }, // West
      ];

      const direction =
        directions[Math.floor(Math.random() * directions.length)];
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

    return monster;
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
    radius = 5
  ): Promise<Monster[]> {
    const monsters: Monster[] = [];
    const spawnCount = Math.floor(Math.random() * 3) + 1; // 1-3 monsters

    for (let i = 0; i < spawnCount; i++) {
      // Random position within radius
      const angle = Math.random() * 2 * Math.PI;
      const distance = Math.random() * radius;
      const x = Math.floor(centerX + Math.cos(angle) * distance);
      const y = Math.floor(centerY + Math.sin(angle) * distance);

      // For now, assume biome ID 1 (we'd need to fetch from world service in real implementation)
      const monster = await this.spawnMonster(x, y, 1);
      monsters.push(monster);
    }

    return monsters;
  }
}
