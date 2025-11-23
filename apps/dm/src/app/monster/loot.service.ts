import { EventBus } from '../../shared/event-bus';
import { Logger } from '@nestjs/common';
import { LootGenerator } from './loot-generator';
import { PrismaClient, WorldItem, type Player } from '@mud/database';
import type { Prisma } from '@mud/database';
import { Injectable } from '@nestjs/common';

type MonsterDeathEvent = {
  monster: { id: number; level?: number };
  x: number;
  y: number;
};

@Injectable()
export class LootService {
  private readonly logger = new Logger(LootService.name);
  private prisma = new PrismaClient();
  private generator: LootGenerator;

  constructor() {
    // Subscribe to monster:death events
    this.logger.debug('Subscribing to monster:death events');
    // Provide the Prisma client to the generator so it can look up item
    // templates when it creates drops.
    this.generator = new LootGenerator(this.prisma);
    EventBus.on('monster:death', this.handleMonsterDeath.bind(this));
  }

  private async handleMonsterDeath(event: MonsterDeathEvent) {
    const monster = event.monster;
    this.logger.debug(
      `handleMonsterDeath received for monsterId=${monster.id} at (${event.x},${event.y})`,
    );

    const monsterLoot = await this.generator.generateForMonster(monster);
    this.logger.debug(
      `Generated ${monsterLoot.length} potential drop(s) for monsterId=${monster.id}`,
    );

    const drops = await this.persistLootDrops(monsterLoot, event.x, event.y, {
      spawnedByMonsterId: monster.id,
    });
    await this.emitLootSpawn(event.x, event.y, drops, monsterLoot, {
      spawnedByMonsterId: monster.id,
    });
  }

  /**
   * Explicitly spawn loot at a player's location using the same generator logic as
   * monster death drops. Useful for debugging/commands that need a real drop.
   */
  async spawnLootForPlayer(player: Player): Promise<WorldItem[]> {
    if (
      player.x === null ||
      player.y === null ||
      typeof player.x !== 'number' ||
      typeof player.y !== 'number'
    ) {
      throw new Error('Player location is unknown; cannot spawn loot.');
    }
    const level = typeof player.level === 'number' ? player.level : 1;
    const generated = await this.generator.generateForMonster({
      level,
    });
    this.logger.debug(
      `Generated ${generated.length} drop(s) for player-triggered loot at (${player.x},${player.y})`,
    );
    const drops = await this.persistLootDrops(generated, player.x, player.y, {
      spawnedByMonsterId: undefined,
    });
    await this.emitLootSpawn(player.x, player.y, drops, generated, {
      spawnedByMonsterId: undefined,
    });
    return drops;
  }

  private async persistLootDrops(
    loot: Array<{
      itemId: number;
      quality: string;
      quantity?: number;
      baseRank?: number | null;
      item?: { name?: string } | null;
    }>,
    x: number,
    y: number,
    meta: { spawnedByMonsterId?: number | undefined },
  ): Promise<WorldItem[]> {
    const drops: WorldItem[] = [];
    // Validate item IDs exist before persisting to avoid foreign key violations
    const itemIds = Array.from(
      new Set(loot.map((d) => Number(d.itemId)).filter(Boolean)),
    );

    let validItemIds = new Set<number>();
    if (itemIds.length > 0) {
      try {
        const items = await this.prisma.item.findMany({
          where: { id: { in: itemIds } },
        });
        validItemIds = new Set(items.map((i) => i.id));
        const missing = itemIds.filter((id) => !validItemIds.has(id));
        if (missing.length > 0) {
          this.logger.warn(
            `Loot generator produced ${missing.length} unknown itemId(s): ${missing.join(', ')}`,
          );
        }
      } catch (err) {
        this.logger.error(
          'Failed to validate item IDs before creating WorldItems',
          err as Error,
        );
        // fall back to attempting to create rows; individual create errors will be caught below
      }
    }

    // Persist WorldItem rows for each drop (skip if item missing)
    for (const drop of loot) {
      if (
        !drop ||
        typeof drop.itemId !== 'number' ||
        Number.isNaN(drop.itemId)
      ) {
        this.logger.warn(
          'Skipping invalid drop with missing or non-numeric itemId',
          drop as unknown as Error,
        );
        continue;
      }

      if (itemIds.length > 0 && !validItemIds.has(drop.itemId)) {
        this.logger.warn(`Skipping drop for unknown itemId=${drop.itemId}`);
        continue;
      }

      try {
        const droppedItem = await this.prisma.worldItem.create({
          data: {
            itemId: drop.itemId,
            quality: drop.quality,
            rank: drop.baseRank ?? undefined,
            x,
            y,
            quantity: drop.quantity ?? 1,
            spawnedByMonsterId: meta.spawnedByMonsterId,
          } as Prisma.WorldItemUncheckedCreateInput,
        });
        this.logger.debug(
          `Created WorldItem id=${droppedItem.id} itemId=${droppedItem.itemId} qty=${droppedItem.quantity}`,
        );
        drops.push(droppedItem);
      } catch (err) {
        // Prisma P2003 (foreign key) can happen if item was deleted between validation and insert
        this.logger.error('Failed to persist WorldItem drop', err as Error);
      }
    }

    return drops;
  }

  // Publish loot:spawn event (optional) — EventBus supports emit with eventType
  private async emitLootSpawn(
    x: number,
    y: number,
    drops: WorldItem[],
    generated: Array<{
      itemId: number;
      item?: { name?: string } | null;
    }>,
    meta: { spawnedByMonsterId?: number | undefined },
  ): Promise<void> {
    try {
      // Attach human-friendly item names to the event payload when
      // available from the generator's lookup.
      const itemNameMap = new Map<number, string>();
      for (const d of generated) {
        if (d && d.item && typeof d.item.name === 'string') {
          itemNameMap.set(d.itemId, d.item.name);
        }
      }

      const eventDrops = drops.map((d) => ({
        id: d.id,
        itemId: d.itemId,
        quantity: d.quantity,
        quality: d.quality,
        x: d.x,
        y: d.y,
        spawnedByMonsterId: meta.spawnedByMonsterId,
        itemName: itemNameMap.get(d.itemId) ?? null,
      }));

      EventBus.emit({
        eventType: 'loot:spawn',
        x,
        y,
        drops: eventDrops,
        timestamp: new Date(),
      });
      this.logger.debug(
        `Emitted loot:spawn for (${x},${y}) with ${drops.length} persisted drop(s)`,
      );
    } catch (err) {
      this.logger.error('Failed to emit loot:spawn event', err as Error);
    }
  }
}
