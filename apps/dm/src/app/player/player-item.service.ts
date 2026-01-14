import { Injectable } from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { AppError, ErrCodes } from '../errors/app-error';
import type { Prisma, Item, PlayerItem } from '@mud/database';
import { PlayerSlot } from '@mud/database';
import {
  calculateEquipmentEffects,
  type EquippedPlayerItem,
  type EquipmentTotals,
} from './equipment.effects';

@Injectable()
export class PlayerItemService {
  private prisma = getPrismaClient();

  constructor() {}

  // List bag items (not including equipped items unless requested)
  async listBag(
    playerId: number,
  ): Promise<Array<PlayerItem & Prisma.ItemInclude>> {
    return this.prisma.playerItem.findMany({
      where: { playerId },
      include: { item: true },
    });
  }

  async listEquipped(playerId: number): Promise<Array<EquippedPlayerItem>> {
    return this.prisma.playerItem.findMany({
      where: { playerId, equipped: true },
      include: { item: true },
    });
  }

  async getEquipmentTotals(playerId: number): Promise<EquipmentTotals> {
    const equippedItems = await this.listEquipped(playerId);
    return calculateEquipmentEffects(equippedItems).totals;
  }

  // Equip an item by playerItemId into a slot
  async equip(
    playerId: number,
    playerItemId: number,
    slot: PlayerSlot,
  ): Promise<PlayerItem & Prisma.ItemInclude> {
    // Basic equip logic: ensure ownership, unequip any other item in the same slot, set equipped
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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
          allowedSlots.push(PlayerSlot.weapon);
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
      return tx.playerItem.update({
        where: { id: playerItemId },
        data: { equipped: true, slot },
        include: { item: true },
      });
    });
  }

  // Unequip an item
  async unequip(
    playerId: number,
    playerItemId: number,
  ): Promise<PlayerItem & Prisma.ItemInclude> {
    const pi = await this.prisma.playerItem.findUnique({
      where: { id: playerItemId },
    });
    if (!pi || pi.playerId !== playerId) {
      throw new AppError(
        ErrCodes.NOT_OWNED,
        'Item not found or not owned by player',
      );
    }
    return this.prisma.playerItem.update({
      where: { id: playerItemId },
      data: { equipped: false, slot: null },
      include: { item: true },
    });
  }

  // No world items exist in the run-based loop.
}
