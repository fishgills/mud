import { EventBus } from '@mud/engine';
import { LootGenerator } from './loot-generator';
import { PrismaClient } from '@prisma/client';

type MonsterDeathEvent = {
  monster: { id: number; level?: number };
  x: number;
  y: number;
};

export class LootService {
  private prisma = new PrismaClient();
  private generator = new LootGenerator();

  constructor() {
    // Subscribe to monster:death events
    EventBus.on('monster:death', this.handleMonsterDeath.bind(this));
  }

  private async handleMonsterDeath(event: MonsterDeathEvent) {
    const monster = event.monster;
    const drops = this.generator.generateForMonster(monster);
    // Persist WorldItem rows for each drop
    for (const drop of drops) {
      await this.prisma.worldItem.create({
        data: {
          itemId: drop.itemId,
          quality: drop.quality,
          x: event.x,
          y: event.y,
          quantity: drop.quantity ?? 1,
          spawnedByMonsterId: monster.id,
        },
      });
    }
    // Publish loot:spawn event (optional) — EventBus supports emit with eventType
    try {
      // @ts-expect-error: EventBus.emit accepts a limited set of typed events; treat as generic publish
      EventBus.emit({ eventType: 'loot:spawn', x: event.x, y: event.y, drops });
    } catch {
      // ignore
    }
  }
}
