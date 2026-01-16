import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ItemType, PlayerSlot } from '@mud/database';
import { randomUUID } from 'crypto';
import { PlayerService } from '../../app/player/player.service';
import { GuildShopRepository } from './guild-shop.repository';
import { GuildShopPublisher } from './guild-shop.publisher';
import type { GuildTradeResponse } from '@mud/api-contracts';
import { RunsService } from '../runs/runs.service';
import { formatWeaponRoll } from './guild-shop-progression';

interface BuyRequest {
  teamId: string;
  userId: string;
  sku?: string;
  item?: string;
  quantity?: number;
}

interface SellRequest {
  teamId: string;
  userId: string;
  item?: string;
  playerItemId?: number;
  quantity?: number;
}

@Injectable()
export class GuildShopService {
  private readonly logger = new Logger(GuildShopService.name);

  constructor(
    private readonly playerService: PlayerService,
    private readonly repository: GuildShopRepository,
    private readonly publisher: GuildShopPublisher,
    private readonly runsService: RunsService,
  ) {}

  async listCatalog(): Promise<
    Array<{
      sku: string;
      name: string;
      description: string;
      buyPriceGold: number;
      sellPriceGold: number;
      stockQuantity: number;
      slot?: string | null;
      tags: string[];
      damageRoll?: string | null;
      defense?: number | null;
      quality?: string | null;
      tier?: number | null;
      offsetK?: number | null;
      itemPower?: number | null;
      strengthBonus?: number | null;
      agilityBonus?: number | null;
      healthBonus?: number | null;
      weaponDiceCount?: number | null;
      weaponDiceSides?: number | null;
      ticketRequirement?: string | null;
      archetype?: string | null;
    }>
  > {
    const entries = await this.repository.listActiveCatalog();
    return entries.map((entry) => ({
      sku: entry.sku,
      name: entry.name,
      description: entry.description ?? '',
      buyPriceGold: entry.buyPriceGold,
      sellPriceGold: entry.sellPriceGold ?? Math.floor(entry.buyPriceGold / 2),
      stockQuantity: entry.stockQuantity ?? 0,
      slot:
        entry.itemTemplate?.slot ??
        (entry.itemTemplate?.type === ItemType.WEAPON
          ? PlayerSlot.weapon
          : null),
      tags: entry.tags ?? [],
      damageRoll:
        entry.itemTemplate?.damageRoll ??
        (entry.weaponDiceCount && entry.weaponDiceSides
          ? formatWeaponRoll(entry.weaponDiceCount, entry.weaponDiceSides)
          : null),
      defense: entry.itemTemplate?.defense ?? null,
      quality: entry.quality ?? null,
      tier: entry.tier ?? null,
      offsetK: entry.offsetK ?? null,
      itemPower: entry.itemPower ?? null,
      strengthBonus: entry.strengthBonus ?? null,
      agilityBonus: entry.agilityBonus ?? null,
      healthBonus: entry.healthBonus ?? null,
      weaponDiceCount: entry.weaponDiceCount ?? null,
      weaponDiceSides: entry.weaponDiceSides ?? null,
      ticketRequirement: entry.ticketRequirement ?? null,
      archetype: entry.archetype ?? null,
    }));
  }

  async buy(data: BuyRequest): Promise<GuildTradeResponse> {
    const player = await this.playerService.getPlayer(
      data.teamId,
      data.userId,
      {
        requireCreationComplete: true,
      },
    );
    const activeRun = await this.runsService.getActiveRunForPlayer(player.id);
    if (activeRun) {
      throw new BadRequestException('Finish your raid before trading.');
    }

    const searchTerm = data.sku ?? data.item;
    if (!searchTerm) {
      throw new BadRequestException('Select an item from the guild catalog.');
    }

    const catalogItem = data.sku
      ? await this.repository.findCatalogItemBySku(data.sku)
      : await this.repository.findCatalogItemByTerm(searchTerm);
    if (!catalogItem) {
      throw new BadRequestException('No guild shop item matches your request.');
    }

    const quantity = data.quantity && data.quantity > 0 ? data.quantity : 1;

    try {
      const purchase = await this.repository.purchaseItem(
        player,
        catalogItem,
        quantity,
      );

      const correlationId = purchase.receipt.correlationId ?? randomUUID();
      const response: GuildTradeResponse = {
        receiptId: purchase.receipt.id.toString(),
        playerId: player.id.toString(),
        itemId: catalogItem.id.toString(),
        direction: 'BUY',
        goldDelta: purchase.receipt.goldDelta,
        remainingGold: purchase.updatedPlayer.gold,
        inventoryDelta: purchase.createdPlayerItem.quantity,
        stockRemaining: purchase.catalogItem.stockQuantity - quantity,
        correlationId,
      };

      await this.publisher.publishReceipt(response, {
        teamId: data.teamId,
        userId: data.userId,
      });
      return response;
    } catch (error) {
      this.logger.warn('Guild shop purchase failed', error as Error);
      if (error instanceof BadRequestException) throw error;
      const message = this.resolvePurchaseError(error);
      throw new BadRequestException(message);
    }
  }

  async sell(data: SellRequest): Promise<GuildTradeResponse> {
    const player = await this.playerService.getPlayer(
      data.teamId,
      data.userId,
      {
        requireCreationComplete: true,
      },
    );
    const activeRun = await this.runsService.getActiveRunForPlayer(player.id);
    if (activeRun) {
      throw new BadRequestException('Finish your raid before trading.');
    }

    const quantity = data.quantity && data.quantity > 0 ? data.quantity : 1;

    const playerItem = data.playerItemId
      ? await this.repository.getPlayerItemById(data.playerItemId, player.id)
      : data.item
        ? await this.repository.getPlayerItemByName(player.id, data.item)
        : null;

    if (!playerItem) {
      throw new BadRequestException('Item not found in your inventory.');
    }

    const catalog = await this.repository.findCatalogByTemplate(
      playerItem.itemId,
    );
    // Removed check for catalog existence to allow selling unlisted items

    try {
      const result = await this.repository.sellItem(
        player,
        catalog,
        playerItem,
        quantity,
      );

      const correlationId = result.receipt.correlationId ?? randomUUID();
      const response: GuildTradeResponse = {
        receiptId: result.receipt.id.toString(),
        playerId: player.id.toString(),
        itemId: catalog?.id.toString() ?? '0', // Use '0' for unlisted items
        direction: 'SELL',
        goldDelta: result.receipt.goldDelta,
        remainingGold: result.updatedPlayer.gold,
        inventoryDelta: -quantity,
        stockRemaining: (catalog?.stockQuantity ?? 0) + quantity,
        correlationId,
        itemName: result.itemName,
        itemQuality: result.itemQuality,
      };

      await this.publisher.publishReceipt(response, {
        teamId: data.teamId,
        userId: data.userId,
      });
      return response;
    } catch (error) {
      this.logger.warn('Guild shop sale failed', error as Error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Sale failed',
      );
    }
  }

  private resolvePurchaseError(error: unknown): string {
    if (!(error instanceof Error)) {
      return 'Purchase failed';
    }
    switch (error.message) {
      case 'INSUFFICIENT_STOCK':
        return 'That item just sold out.';
      case 'INSUFFICIENT_GOLD':
        return 'You do not have enough gold.';
      case 'INSUFFICIENT_EPIC_TICKETS':
        return 'An Epic Ticket is required for this item.';
      case 'INSUFFICIENT_LEGENDARY_TICKETS':
        return 'A Legendary Ticket is required for this item.';
      case 'INSUFFICIENT_RARE_TICKETS':
        return 'A Rare Ticket is required for this item.';
      default:
        return error.message || 'Purchase failed';
    }
  }
}
