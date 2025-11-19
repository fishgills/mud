import { Body, Controller, Post } from '@nestjs/common';
import { GuildShopService } from './guild-shop.service';
import type { GuildTradeResponse } from '@mud/api-contracts';

@Controller('guild/shop')
export class GuildShopController {
  constructor(private readonly shopService: GuildShopService) {}

  @Post('buy')
  async buy(
    @Body()
    body: {
      teamId: string;
      userId: string;
      item: string;
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
}
