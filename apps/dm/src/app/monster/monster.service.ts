import { Injectable } from '@nestjs/common';
import { MonsterFactory, MonsterEntity } from '@mud/engine';
import { WorldService } from '../world/world.service';
import { getMonsterTemplate, pickTypeForBiome } from './monster.types';
import { isWaterBiome } from '../shared/biome.util';

@Injectable()
export class MonsterService {
  constructor(private worldService: WorldService) {}

  async spawnMonster(
    x: number,
    y: number,
    biomeId: number,
  ): Promise<MonsterEntity> {
    const tile = await this.worldService.getTileInfo(x, y);
    if (isWaterBiome(tile.biomeName)) {
      throw new Error('Cannot spawn monsters in water.');
    }

    const resolvedBiomeId = tile.biomeId ?? biomeId;

    // Use MonsterFactory to create and return the monster entity
    return MonsterFactory.create({
      x,
      y,
      biomeId: resolvedBiomeId,
    });
  }

  async getAllMonsters(): Promise<MonsterEntity[]> {
    return MonsterFactory.loadAll();
  }

  async getMonstersAtLocation(x: number, y: number): Promise<MonsterEntity[]> {
    return MonsterFactory.loadAtLocation(x, y);
  }

  async getMonstersInBounds(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): Promise<MonsterEntity[]> {
    return MonsterFactory.loadInBounds(minX, maxX, minY, maxY);
  }

  async moveMonster(monsterId: number): Promise<MonsterEntity> {
    const entity = await MonsterFactory.load(monsterId);

    if (!entity) {
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
    const newX = entity.position.x + direction.dx;
    const newY = entity.position.y + direction.dy;

    const targetTile = await this.worldService.getTileInfo(newX, newY);
    if (isWaterBiome(targetTile.biomeName)) {
      // Just update last move timestamp
      entity.lastMove = new Date();
      await MonsterFactory.save(entity);
    } else {
      // Move to new position
      entity.moveTo(newX, newY);
      entity.lastMove = new Date();
      await MonsterFactory.save(entity);
    }

    return entity;
  }

  async damageMonster(
    monsterId: number,
    damage: number,
  ): Promise<MonsterEntity> {
    const entity = await MonsterFactory.load(monsterId);

    if (!entity) {
      throw new Error('Monster not found or not alive');
    }

    // Use entity's takeDamage method
    entity.takeDamage(damage);
    await MonsterFactory.save(entity);

    return entity;
  }

  async cleanupDeadMonsters(): Promise<void> {
    // Remove monsters that have been dead for more than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    await MonsterFactory.deleteMany({
      isAlive: false,
      updatedAt: {
        lt: oneHourAgo,
      },
    });
  }

  async spawnMonstersInArea(
    centerX: number,
    centerY: number,
    radius = 5,
    constraints?: { avoidSettlementsWithin?: number; maxGroupSize?: number },
  ): Promise<MonsterEntity[]> {
    const monsters: MonsterEntity[] = [];
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
  ): Promise<MonsterEntity> {
    // Get template matching type from centralized table
    const template = getMonsterTemplate(type);

    // Use MonsterFactory with specific template
    return MonsterFactory.create({
      x,
      y,
      biomeId,
      template,
    });
  }
}
