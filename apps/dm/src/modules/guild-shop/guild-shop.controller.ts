import { Body, Controller, Get, Post } from '@nestjs/common';
import { GuildShopService } from './guild-shop.service';
import { GuildShopRotationService } from './guild-shop-rotation.service';
import type { GuildTradeResponse } from '@mud/api-contracts';
import type { GuildCatalogItem } from '@mud/api-contracts';

@Controller('guild/shop')
export class GuildShopController {
  constructor(
    private readonly shopService: GuildShopService,
    private readonly rotationService: GuildShopRotationService,
  ) {}

  @Get('list')
  async list(): Promise<GuildCatalogItem[]> {
    const items = await this.shopService.listCatalog();
    return items.map((item) => ({
      sku: item.sku,
      name: item.name,
      description: item.description,
      buyPriceGold: item.buyPriceGold,
      sellPriceGold: item.sellPriceGold,
      stockQuantity: item.stockQuantity,
      tags: item.tags,
      damageRoll: item.damageRoll ?? undefined,
      defense: item.defense ?? undefined,
      healthBonus: item.healthBonus ?? undefined,
      quality: item.quality ?? undefined,
    }));
  }

  @Post('buy')
  async buy(
    @Body()
    body: {
      teamId: string;
      userId: string;
      sku?: string;
      item?: string;
      quantity?: number;
    },
  ): Promise<GuildTradeResponse> {
    return this.shopService.buy(body);
  }

  @Post('sell')
  async sell(
    @Body()
    body: {
      teamId: string;
      userId: string;
      item?: string;
      playerItemId?: number;
      quantity?: number;
    },
  ): Promise<GuildTradeResponse> {
    return this.shopService.sell(body);
  }

  @Post('rotate')
  async rotate(): Promise<{ rotated: boolean; items?: number }> {
    const result = await this.rotationService.rotateIfDue('manual');
    return result;
  }
}
