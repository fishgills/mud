import { Injectable, Logger } from '@nestjs/common';
import type { GuildTradeResponse } from '@mud/api-contracts';
import { getPrismaClient } from '@mud/database';
import { EventBus } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { formatWebRecipientId } from '@mud/redis-client';

@Injectable()
export class GuildShopPublisher {
  private readonly logger = new Logger(GuildShopPublisher.name);
  private readonly prisma = getPrismaClient();

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

  async publishRefresh(payload: {
    source: 'tick' | 'manual';
    items: number;
  }): Promise<void> {
    try {
      const event = {
        eventType: 'guild.shop.refresh' as const,
        source: payload.source,
        items: payload.items,
        timestamp: new Date(),
      };

      await EventBus.emit(event);

      const slackUsers = await this.prisma.slackUser.findMany({
        select: { teamId: true, userId: true },
      });
      if (slackUsers.length === 0) {
        return;
      }

      await this.eventBridge.publishNotification({
        type: 'player',
        event,
        recipients: slackUsers.map((user) => ({
          clientType: 'web',
          teamId: undefined,
          userId: formatWebRecipientId(user.teamId, user.userId),
          message: 'Store refreshed.',
          priority: 'normal',
        })),
      });
    } catch (error) {
      this.logger.warn('Failed to emit guild shop refresh', error as Error);
    }
  }
}
