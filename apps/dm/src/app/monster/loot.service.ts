import { EventBus } from '../../shared/event-bus';
import { Logger } from '@nestjs/common';
import { LootGenerator } from './loot-generator';
import { PrismaClient, WorldItem } from '@mud/database';
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

    const drops: WorldItem[] = [];
    // Validate item IDs exist before persisting to avoid foreign key violations
    const itemIds = Array.from(
      new Set(monsterLoot.map((d) => Number(d.itemId)).filter(Boolean)),
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
            `Loot generator produced ${missing.length} unknown itemId(s) for monsterId=${monster.id}: ${missing.join(', ')}`,
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
    for (const drop of monsterLoot) {
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
            x: event.x,
            y: event.y,
            quantity: drop.quantity ?? 1,
            spawnedByMonsterId: monster.id,
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

    // Publish loot:spawn event (optional) — EventBus supports emit with eventType
    try {
      // Attach human-friendly item names to the event payload when
      // available from the generator's lookup.
      const itemNameMap = new Map<number, string>();
      for (const d of monsterLoot) {
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
        spawnedByMonsterId: d.spawnedByMonsterId,
        itemName: itemNameMap.get(d.itemId) ?? null,
      }));

      EventBus.emit({
        eventType: 'loot:spawn',
        x: event.x,
        y: event.y,
        drops: eventDrops,
        timestamp: new Date(),
      });
      this.logger.debug(
        `Emitted loot:spawn for (${event.x},${event.y}) with ${drops.length} persisted drop(s)`,
      );
    } catch (err) {
      this.logger.error('Failed to emit loot:spawn event', err as Error);
    }
  }
}
