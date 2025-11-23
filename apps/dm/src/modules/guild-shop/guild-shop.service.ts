import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PlayerService } from '../../app/player/player.service';
import { GuildShopRepository } from './guild-shop.repository';
import { GuildShopPublisher } from './guild-shop.publisher';
import type { Player } from '@mud/database';
import type { GuildTradeResponse } from '@mud/api-contracts';

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
  ) {}

  async listCatalog(): Promise<
    Array<{
      sku: string;
      name: string;
      description: string;
      buyPriceGold: number;
      sellPriceGold: number;
      stockQuantity: number;
      tags: string[];
      damageRoll?: string | null;
      defense?: number | null;
      quality?: string | null;
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
      tags: entry.tags ?? [],
      damageRoll: entry.itemTemplate?.damageRoll ?? null,
      defense: entry.itemTemplate?.defense ?? null,
      quality: entry.quality ?? null,
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
    this.ensurePlayerInsideGuild(player);

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

      await this.publisher.publishReceipt(response);
      return response;
    } catch (error) {
      this.logger.warn('Guild shop purchase failed', error as Error);
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Purchase failed',
      );
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
    this.ensurePlayerInsideGuild(player);

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

      await this.publisher.publishReceipt(response);
      return response;
    } catch (error) {
      this.logger.warn('Guild shop sale failed', error as Error);
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Sale failed',
      );
    }
  }

  private ensurePlayerInsideGuild(player: Player): void {
    if (!player.isInHq) {
      throw new BadRequestException(
        'Visit the guild hall first by teleporting before trading.',
      );
    }
  }
}
