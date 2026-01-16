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
  type GuildShopState,
  ItemQuality,
  TicketTier,
} from '@mud/database';
import {
  formatWeaponRoll,
  type GeneratedShopListing,
} from './guild-shop-progression';

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

interface ShopStateUpdate {
  refreshId: string;
  refreshesSinceChase: number;
  globalTier: number;
  medianLevel: number;
  refreshedAt: Date;
}

@Injectable()
export class GuildShopRepository {
  private readonly prisma = getPrismaClient();

  async getShopState(): Promise<GuildShopState | null> {
    return this.prisma.guildShopState.findFirst({
      orderBy: { id: 'desc' },
    });
  }

  async getMedianPlayerLevel(minutesThreshold: number): Promise<number> {
    const cutoff = new Date(Date.now() - minutesThreshold * 60 * 1000);
    const players = await this.prisma.player.findMany({
      where: {
        lastAction: { gte: cutoff },
        isAlive: true,
        isCreationComplete: true,
      },
      select: { level: true },
      orderBy: { level: 'asc' },
    });

    if (players.length === 0) {
      return 1;
    }

    const mid = Math.floor(players.length / 2);
    if (players.length % 2 === 1) {
      return Math.max(1, players[mid].level);
    }

    const lower = players[mid - 1]?.level ?? 1;
    const upper = players[mid]?.level ?? lower;
    return Math.max(1, Math.floor((lower + upper) / 2));
  }

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
      const freshPlayer = await tx.player.findUnique({
        where: { id: player.id },
      });
      if (!freshPlayer) {
        throw new Error('PLAYER_NOT_FOUND');
      }
      const totalCost = freshCatalog.buyPriceGold * quantity;
      if (freshPlayer.gold < totalCost) {
        throw new Error('INSUFFICIENT_GOLD');
      }
      if (!freshCatalog.itemTemplateId) {
        throw new Error('ITEM_TEMPLATE_MISSING');
      }

      const ticketRequirement = freshCatalog.ticketRequirement;
      if (ticketRequirement === TicketTier.Epic) {
        if ((freshPlayer.epicTickets ?? 0) < quantity) {
          throw new Error('INSUFFICIENT_EPIC_TICKETS');
        }
      } else if (ticketRequirement === TicketTier.Legendary) {
        if ((freshPlayer.legendaryTickets ?? 0) < quantity) {
          throw new Error('INSUFFICIENT_LEGENDARY_TICKETS');
        }
      } else if (ticketRequirement === TicketTier.Rare) {
        if ((freshPlayer.rareTickets ?? 0) < quantity) {
          throw new Error('INSUFFICIENT_RARE_TICKETS');
        }
      }

      const ticketUpdates: Prisma.PlayerUpdateInput = {};
      if (ticketRequirement === TicketTier.Epic) {
        ticketUpdates.epicTickets = { decrement: quantity };
      } else if (ticketRequirement === TicketTier.Legendary) {
        ticketUpdates.legendaryTickets = { decrement: quantity };
      } else if (ticketRequirement === TicketTier.Rare) {
        ticketUpdates.rareTickets = { decrement: quantity };
      }

      const updatedPlayer = await tx.player.update({
        where: { id: player.id },
        data: {
          gold: { decrement: totalCost },
          ...ticketUpdates,
        },
      });

      const templateRow = await tx.item.findUnique({
        where: { id: freshCatalog.itemTemplateId },
      });

      const createdPlayerItem = await tx.playerItem.create({
        data: {
          playerId: player.id,
          itemId: freshCatalog.itemTemplateId,
          quantity,
          quality: freshCatalog.quality,
          rank: templateRow?.rank ?? undefined,
        } as Prisma.PlayerItemUncheckedCreateInput,
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

  async replaceCatalog(
    listings: GeneratedShopListing[],
    state: ShopStateUpdate,
  ): Promise<void> {
    if (listings.length === 0) return;
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.shopCatalogItem.deleteMany({ where: { isActive: true } });

      for (const [index, listing] of listings.entries()) {
        const damageRoll =
          listing.weaponDiceCount && listing.weaponDiceSides
            ? formatWeaponRoll(listing.weaponDiceCount, listing.weaponDiceSides)
            : null;
        const item = await tx.item.create({
          data: {
            name: listing.name,
            type: listing.itemType,
            description: listing.description,
            value: listing.priceGold,
            damageRoll: damageRoll ?? undefined,
            defense: 0,
            slot: listing.slot,
            itemPower: listing.itemPower,
            tier: listing.tier,
            strengthBonus: listing.strengthBonus,
            agilityBonus: listing.agilityBonus,
            healthBonus: listing.healthBonus,
            weaponDiceCount: listing.weaponDiceCount ?? undefined,
            weaponDiceSides: listing.weaponDiceSides ?? undefined,
          },
        });

        const sellPrice = Math.max(1, Math.floor(listing.priceGold * 0.5));
        const sku = `guild-${state.refreshId}-${index}`;
        await tx.shopCatalogItem.create({
          data: {
            sku,
            name: listing.name,
            description: listing.description,
            buyPriceGold: listing.priceGold,
            sellPriceGold: sellPrice,
            stockQuantity: listing.stockQuantity,
            maxStock: listing.stockQuantity,
            tags: listing.tags,
            isActive: true,
            itemTemplateId: item.id,
            quality: listing.quality ?? ItemQuality.Common,
            refreshId: state.refreshId,
            tier: listing.tier,
            offsetK: listing.offsetK,
            itemPower: listing.itemPower,
            strengthBonus: listing.strengthBonus,
            agilityBonus: listing.agilityBonus,
            healthBonus: listing.healthBonus,
            weaponDiceCount: listing.weaponDiceCount ?? undefined,
            weaponDiceSides: listing.weaponDiceSides ?? undefined,
            archetype: listing.archetype,
            ticketRequirement: listing.ticketRequirement ?? undefined,
          },
        });
      }

      const existingState = await tx.guildShopState.findFirst({
        orderBy: { id: 'desc' },
      });
      if (existingState) {
        await tx.guildShopState.update({
          where: { id: existingState.id },
          data: {
            refreshId: state.refreshId,
            refreshesSinceChase: state.refreshesSinceChase,
            globalTier: state.globalTier,
            medianLevel: state.medianLevel,
            lastRefreshedAt: state.refreshedAt,
          },
        });
      } else {
        await tx.guildShopState.create({
          data: {
            refreshId: state.refreshId,
            refreshesSinceChase: state.refreshesSinceChase,
            globalTier: state.globalTier,
            medianLevel: state.medianLevel,
            lastRefreshedAt: state.refreshedAt,
          },
        });
      }
    });
  }
}
