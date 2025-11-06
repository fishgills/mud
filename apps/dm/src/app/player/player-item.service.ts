import { createClient } from 'redis';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getPrismaClient } from '@mud/database';
import { AppError, ErrCodes } from '../errors/app-error';
import type { Prisma, Item, PlayerItem, WorldItem } from '@prisma/client';
import { PlayerSlot } from '@prisma/client';

@Injectable()
export class PlayerItemService {
  private prisma = getPrismaClient();

  constructor() {}

  // List bag items (not including equipped items unless requested)
  async listBag(
    playerId: number,
  ): Promise<Array<PlayerItem & { item: Item | null }>> {
    return this.prisma.playerItem.findMany({
      where: { playerId },
      include: { item: true },
    });
  }

  // Equip an item by playerItemId into a slot
  async equip(
    playerId: number,
    playerItemId: number,
    slot: PlayerSlot,
  ): Promise<void> {
    // Basic equip logic: ensure ownership, unequip any other item in the same slot, set equipped
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pi = await tx.playerItem.findUnique({
        where: { id: playerItemId },
        include: { item: true },
      });
      if (!pi || pi.playerId !== playerId) {
        throw new AppError(
          ErrCodes.NOT_OWNED,
          'Item not found or not owned by player',
        );
      }

      // Server-side validation: ensure the item can be equipped to the requested slot
      // slot is typed as PlayerSlot so invalid values will be prevented by TypeScript at compile time

      const item = (pi as PlayerItem & { item?: Item | null }).item ?? null;
      const allowedSlots: string[] = [];
      // Some generated Prisma client versions may not include the `slot` field on Item
      // in their type definition (schema/client drift). Narrow safely at runtime.
      if (item) {
        const slotVal = (item as unknown as { slot?: PlayerSlot | null }).slot;
        if (slotVal) {
          allowedSlots.push(String(slotVal));
        } else if ((item as unknown as { type?: string }).type === 'weapon') {
          // fallback by type for legacy weapon items
          allowedSlots.push('weapon');
        }
      }

      if (allowedSlots.length === 0) {
        throw new AppError(
          ErrCodes.ITEM_NOT_EQUIPPABLE,
          'This item cannot be equipped',
        );
      }

      if (!allowedSlots.includes(slot)) {
        throw new AppError(
          ErrCodes.INVALID_SLOT,
          `Item cannot be equipped to slot '${slot}'. Allowed: ${allowedSlots.join(', ')}`,
        );
      }

      // Unequip others in the same slot
      await tx.playerItem.updateMany({
        where: { playerId, slot, equipped: true },
        data: { equipped: false, slot: null },
      });

      // Equip this item and set its slot
      await tx.playerItem.update({
        where: { id: playerItemId },
        data: { equipped: true, slot },
      });
    });
  }

  // Unequip an item
  async unequip(playerId: number, playerItemId: number): Promise<void> {
    const pi = await this.prisma.playerItem.findUnique({
      where: { id: playerItemId },
    });
    if (!pi || pi.playerId !== playerId) {
      throw new AppError(
        ErrCodes.NOT_OWNED,
        'Item not found or not owned by player',
      );
    }
    await this.prisma.playerItem.update({
      where: { id: playerItemId },
      data: { equipped: false, slot: null },
    });
  }

  // Pickup a world item (move WorldItem -> PlayerItem) with capacity checks and locking
  async pickup(
    playerId: number,
    worldItemId: number,
  ): Promise<(PlayerItem & { item?: Item | null }) | null> {
    const redis = createClient({
      url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    });
    await redis.connect();
    const lockKey = `lock:pickup:${worldItemId}`;
    const token = randomUUID();
    const lockAcquired = await redis.set(lockKey, token, {
      NX: true,
      PX: 5000,
    });
    if (lockAcquired !== 'OK') {
      await redis.disconnect();
      throw new AppError(
        ErrCodes.LOCKED,
        'Item is being picked up by someone else',
      );
    }

    try {
      const result = await this.prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const worldItem = await tx.worldItem.findUnique({
            where: { id: worldItemId },
          });
          if (!worldItem) {
            throw new AppError(
              ErrCodes.WORLD_ITEM_NOT_FOUND,
              'World item not found',
            );
          }

          // Get player and capacity
          const player = await tx.player.findUnique({
            where: { id: playerId },
          });
          if (!player)
            throw new AppError(ErrCodes.PLAYER_NOT_FOUND, 'Player not found');
          const capacity = 10 + (player.strength ?? 0);
          const currentCount = await tx.playerItem.count({
            where: { playerId },
          });
          if (currentCount >= capacity) {
            throw new AppError(ErrCodes.INVENTORY_FULL, 'Inventory is full');
          }

          // Create PlayerItem
          const created = await tx.playerItem.create({
            data: {
              playerId,
              itemId: worldItem.itemId,
              quantity: worldItem.quantity ?? 1,
              equipped: false,
              slot: null,
              quality: worldItem.quality,
            },
          });

          // Remove world item
          await tx.worldItem.delete({ where: { id: worldItemId } });

          return created;
        },
      );

      return result;
    } finally {
      // Release lock only if it still holds our token (best-effort)
      try {
        const v = await redis.get(lockKey);
        if (v === token) {
          await redis.del(lockKey);
        }
      } catch {
        // best-effort
      }
      await redis.disconnect();
    }
  }

  // Drop a player item onto the world (create WorldItem and remove PlayerItem)
  async drop(playerId: number, playerItemId: number): Promise<WorldItem> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const pi = await tx.playerItem.findUnique({
        where: { id: playerItemId },
      });
      if (!pi || pi.playerId !== playerId) {
        throw new Error('Item not found or not owned by player');
      }

      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) throw new Error('Player not found');

      const created = await tx.worldItem.create({
        data: {
          itemId: pi.itemId,
          quality: pi.quality,
          x: player.x,
          y: player.y,
          quantity: pi.quantity ?? 1,
          spawnedByMonsterId: null,
        },
      });

      await tx.playerItem.delete({ where: { id: playerItemId } });

      return created;
    });
  }
}
