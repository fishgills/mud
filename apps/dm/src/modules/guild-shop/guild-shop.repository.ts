import { Injectable } from '@nestjs/common';
import {
  getPrismaClient,
  GuildTradeDirection,
  type Player,
  type ShopCatalogItem,
  type PlayerItem,
  type Prisma,
} from '@mud/database';
import type { TransactionReceipt } from '@prisma/client';

interface PurchaseResult {
  updatedPlayer: Player;
  catalogItem: ShopCatalogItem;
  createdPlayerItem: PlayerItem;
  receipt: TransactionReceipt;
}

interface SellResult {
  updatedPlayer: Player;
  catalogItem: ShopCatalogItem;
  removedPlayerItemId: number;
  receipt: TransactionReceipt;
}

@Injectable()
export class GuildShopRepository {
  private readonly prisma = getPrismaClient();

  async findCatalogItemByTerm(term: string): Promise<ShopCatalogItem | null> {
    const normalized = term.trim().toLowerCase();
    return this.prisma.shopCatalogItem.findFirst({
      where: {
        isActive: true,
        OR: [
          { sku: { equals: normalized, mode: 'insensitive' } },
          { name: { equals: normalized, mode: 'insensitive' } },
        ],
      },
    });
  }

  async findCatalogByTemplate(itemId: number): Promise<ShopCatalogItem | null> {
    return this.prisma.shopCatalogItem.findFirst({
      where: { itemTemplateId: itemId, isActive: true },
    });
  }

  async getPlayerItemByName(
    playerId: number,
    term: string,
  ): Promise<PlayerItem | null> {
    const normalized = term.trim().toLowerCase();
    return this.prisma.playerItem.findFirst({
      where: {
        playerId,
        item: {
          name: { equals: normalized, mode: 'insensitive' },
        },
      },
      include: { item: true },
    });
  }

  async getPlayerItemById(
    playerItemId: number,
    playerId: number,
  ): Promise<PlayerItem | null> {
    return this.prisma.playerItem.findFirst({
      where: { id: playerItemId, playerId },
      include: { item: true },
    });
  }

  async purchaseItem(
    player: Player,
    catalog: ShopCatalogItem,
    quantity: number,
  ): Promise<PurchaseResult> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const freshCatalog = await tx.shopCatalogItem.findUnique({
        where: { id: catalog.id },
      });
      if (!freshCatalog || !freshCatalog.isActive) {
        throw new Error('Shop item unavailable');
      }
      if (freshCatalog.stockQuantity < quantity) {
        throw new Error('INSUFFICIENT_STOCK');
      }
      const totalCost = freshCatalog.buyPriceGold * quantity;
      if (player.gold < totalCost) {
        throw new Error('INSUFFICIENT_GOLD');
      }
      if (!freshCatalog.itemTemplateId) {
        throw new Error('ITEM_TEMPLATE_MISSING');
      }

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          gold: player.gold - totalCost,
        },
      });

      const createdPlayerItem = await tx.playerItem.create({
        data: {
          playerId: player.id,
          itemId: freshCatalog.itemTemplateId,
          quantity,
        },
      });

      await tx.shopCatalogItem.update({
        where: { id: freshCatalog.id },
        data: {
          stockQuantity: freshCatalog.stockQuantity - quantity,
        },
      });

      const receipt = await tx.transactionReceipt.create({
        data: {
          playerId: player.id,
          itemId: freshCatalog.id,
          playerItemId: createdPlayerItem.id,
          direction: GuildTradeDirection.BUY,
          goldDelta: -totalCost,
          quantity,
        },
      });

      return {
        updatedPlayer,
        catalogItem: freshCatalog,
        createdPlayerItem,
        receipt,
      };
    });
  }

  async sellItem(
    player: Player,
    catalog: ShopCatalogItem,
    playerItem: PlayerItem,
    quantity: number,
  ): Promise<SellResult> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const freshItem = await tx.playerItem.findUnique({
        where: { id: playerItem.id },
      });
      if (!freshItem || freshItem.playerId !== player.id) {
        throw new Error('PLAYER_ITEM_NOT_FOUND');
      }
      if (freshItem.quantity < quantity) {
        throw new Error('INSUFFICIENT_ITEM_QUANTITY');
      }
      const goldGain = catalog.sellPriceGold * quantity;

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          gold: player.gold + goldGain,
        },
      });

      if (freshItem.quantity === quantity) {
        await tx.playerItem.delete({ where: { id: freshItem.id } });
      } else {
        await tx.playerItem.update({
          where: { id: freshItem.id },
          data: { quantity: freshItem.quantity - quantity },
        });
      }

      await tx.shopCatalogItem.update({
        where: { id: catalog.id },
        data: {
          stockQuantity: (catalog.stockQuantity ?? 0) + quantity,
        },
      });

      const receipt = await tx.transactionReceipt.create({
        data: {
          playerId: player.id,
          itemId: catalog.id,
          playerItemId: freshItem.id,
          direction: GuildTradeDirection.SELL,
          goldDelta: goldGain,
          quantity,
        },
      });

      return {
        updatedPlayer,
        catalogItem: catalog,
        removedPlayerItemId: freshItem.id,
        receipt,
      };
    });
  }
}
