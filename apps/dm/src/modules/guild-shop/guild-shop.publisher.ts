import { Injectable, Logger } from '@nestjs/common';
import type { GuildTradeResponse } from '@mud/api-contracts';
import { EventBus } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { formatWebRecipientId } from '@mud/redis-client';

@Injectable()
export class GuildShopPublisher {
  private readonly logger = new Logger(GuildShopPublisher.name);

  constructor(private readonly eventBridge: EventBridgeService) {}

  async publishReceipt(
    response: GuildTradeResponse,
    context?: { teamId: string; userId: string },
  ): Promise<void> {
    try {
      const event = {
        eventType: 'guild.shop.receipt' as const,
        receipt: response,
        timestamp: new Date(),
      };

      await EventBus.emit(event);

      if (context?.teamId && context.userId) {
        await this.eventBridge.publishNotification({
          type: 'player',
          event,
          recipients: [
            {
              clientType: 'web',
              teamId: undefined,
              userId: formatWebRecipientId(context.teamId, context.userId),
              message: 'Store updated.',
              priority: 'normal',
            },
          ],
        });
      }
    } catch (error) {
      this.logger.warn('Failed to emit guild shop receipt', error as Error);
    }
  }
}
