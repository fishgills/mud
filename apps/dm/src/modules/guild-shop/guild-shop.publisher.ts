import { Injectable, Logger } from '@nestjs/common';
import type { GuildTradeResponse } from '@mud/api-contracts';
import { EventBus } from '../../shared/event-bus';
import { GuildEventType } from '@mud/event-bus';

@Injectable()
export class GuildShopPublisher {
  private readonly logger = new Logger(GuildShopPublisher.name);

  async publishReceipt(response: GuildTradeResponse): Promise<void> {
    try {
      await EventBus.emit({
        eventType: GuildEventType.ShopReceipt,
        receipt: response,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn('Failed to emit guild shop receipt', error as Error);
    }
  }
}
