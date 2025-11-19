import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  getPrismaClient,
  GuildTradeDirection,
  Prisma,
  type Item,
  type Player,
  type PlayerItem,
  type ShopCatalogItem,
  type TransactionReceipt,
} from '@mud/database';

interface PurchaseResult {
  updatedPlayer: Player;
  catalogItem: ShopCatalogItem;
  createdPlayerItem: PlayerItem;
  receipt: TransactionReceipt;
}

interface SellResult {
  updatedPlayer: Player;
  catalogItem: ShopCatalogItem | null;
  removedPlayerItemId: number;
  receipt: TransactionReceipt;
  itemName: string;
  itemQuality: string;
}

@Injectable()
export class GuildShopRepository {
  private readonly prisma = getPrismaClient();

  async findCatalogItemBySku(sku: string): Promise<ShopCatalogItem | null> {
    const normalized = sku.trim().toLowerCase();
    return this.prisma.shopCatalogItem.findFirst({
      where: {
        isActive: true,
        sku: { equals: normalized, mode: 'insensitive' },
      },
    });
  }

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
          correlationId: randomUUID(),
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
    catalog: ShopCatalogItem | null,
    playerItem: PlayerItem,
    quantity: number,
  ): Promise<SellResult> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const freshItem = await tx.playerItem.findUnique({
        where: { id: playerItem.id },
        include: { item: true },
      });
      if (!freshItem || freshItem.playerId !== player.id) {
        throw new Error('PLAYER_ITEM_NOT_FOUND');
      }
      if (freshItem.quantity < quantity) {
        throw new Error('INSUFFICIENT_ITEM_QUANTITY');
      }

      let goldGain = 0;
      if (catalog) {
        goldGain = catalog.sellPriceGold * quantity;
      } else {
        // Fallback pricing for items not in catalog
        const basePrice = Math.max(
          1,
          Math.floor((freshItem.item.value ?? 0) * 0.5),
        );
        goldGain = basePrice * quantity;
      }

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          gold: player.gold + goldGain,
        },
      });

      let receiptPlayerItemId: number | null = freshItem.id;

      if (freshItem.quantity === quantity) {
        await tx.playerItem.delete({ where: { id: freshItem.id } });
        receiptPlayerItemId = null;
      } else {
        await tx.playerItem.update({
          where: { id: freshItem.id },
          data: { quantity: freshItem.quantity - quantity },
        });
      }

      if (catalog) {
        await tx.shopCatalogItem.update({
          where: { id: catalog.id },
          data: {
            stockQuantity: (catalog.stockQuantity ?? 0) + quantity,
          },
        });
      }

      const receipt = await tx.transactionReceipt.create({
        data: {
          playerId: player.id,
          itemId: catalog?.id ?? null,
          playerItemId: receiptPlayerItemId,
          direction: GuildTradeDirection.SELL,
          goldDelta: goldGain,
          quantity,
          correlationId: randomUUID(),
        },
      });

      return {
        updatedPlayer,
        catalogItem: catalog!, // Service layer handles null check if needed, but here we return what we have. Type cast for now, will fix interface.
        removedPlayerItemId: freshItem.id,
        receipt,
        itemName: freshItem.item.name,
        itemQuality: freshItem.quality,
      };
    });
  }

  async listActiveCatalog(): Promise<
    Array<ShopCatalogItem & { itemTemplate?: Item | null }>
  > {
    return this.prisma.shopCatalogItem.findMany({
      where: { isActive: true },
      include: {
        itemTemplate: true,
      },
      orderBy: [{ buyPriceGold: 'asc' }, { name: 'asc' }],
    });
  }

  async deactivateCatalog(): Promise<void> {
    await this.prisma.shopCatalogItem.deleteMany({
      where: { isActive: true },
    });
  }

  async pickRandomItems(count: number): Promise<Item[]> {
    const limit = Math.max(1, count);
    const rows = await this.prisma.$queryRaw<Item[]>`
      SELECT *
      FROM "Item"
      WHERE "value" >= 0
      ORDER BY RANDOM()
      LIMIT ${limit}
    `;
    return rows;
  }

  async createCatalogEntriesFromItems(
    items: Item[],
    options: { rotationIntervalMinutes: number },
  ): Promise<void> {
    if (items.length === 0) return;
    const uniqueItems: Item[] = [];
    const seenNames = new Set<string>();
    for (const item of items) {
      const nameKey = (item.name ?? '').toLowerCase();
      if (!nameKey || seenNames.has(nameKey)) {
        continue;
      }
      seenNames.add(nameKey);
      uniqueItems.push(item);
    }

    if (uniqueItems.length === 0) return;
    const timestamp = Date.now();
    await this.prisma.shopCatalogItem.deleteMany({
      where: {
        name: { in: uniqueItems.map((item) => item.name) },
      },
    });
    await this.prisma.shopCatalogItem.createMany({
      data: uniqueItems.map((item, index) => {
        const buyPrice = this.computeBuyPrice(item);
        const sellPrice = this.computeSellPrice(buyPrice);
        const stockQuantity = this.computeStockQuantity();
        return {
          sku: `guild-${item.id}-${timestamp}-${index}`,
          name: item.name,
          description: item.description ?? '',
          buyPriceGold: buyPrice,
          sellPriceGold: sellPrice,
          stockQuantity,
          maxStock: stockQuantity,
          restockIntervalMinutes: options.rotationIntervalMinutes,
          tags: item.type ? [item.type] : [],
          isActive: true,
          itemTemplateId: item.id,
        };
      }),
    });
  }

  private computeBuyPrice(item: Item): number {
    const base = Math.max(10, item.value ?? 0);
    const variance = Math.round(base * 0.25 * Math.random());
    return base + variance;
  }

  private computeSellPrice(buyPrice: number): number {
    return Math.max(1, Math.floor(buyPrice * 0.5));
  }

  private computeStockQuantity(): number {
    return Math.max(1, 2 + Math.floor(Math.random() * 4));
  }
}
