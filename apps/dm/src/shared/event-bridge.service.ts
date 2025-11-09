/**
 * Event Bridge Service - Connects in-memory EventBus to Redis Pub/Sub
 *
 * This service forwards all game events from the EventBus to Redis,
 * allowing other services (Slack bot, Discord bot, etc.) to subscribe
 * and receive real-time game updates.
 */

import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  RedisEventBridge,
  type NotificationRecipient,
  type NotificationMessage,
} from '@mud/redis-client';
import { EventBus, GameEvent } from './event-bus';
import { env } from '../env';

@Injectable()
export class EventBridgeService implements OnModuleInit, OnModuleDestroy {
  private bridge: RedisEventBridge;
  private readonly logger = new Logger(EventBridgeService.name);

  constructor() {
    this.bridge = new RedisEventBridge({
      redisUrl: env.REDIS_URL,
      channelPrefix: 'game',
      enableLogging: env.isProduction === false,
    });
  }

  async onModuleInit() {
    // Connect to Redis
    await this.bridge.connect();

    // Forward all EventBus events to Redis
    EventBus.onAny(async (event: GameEvent) => {
      try {
        await this.bridge.publishEvent(event);
      } catch (error) {
        this.logger.error('Error publishing event to Redis', error as Error);
      }
    });

    this.logger.log('✅ Event Bridge Service initialized');
  }

  async onModuleDestroy() {
    await this.bridge.disconnect();
  }

  /**
   * Publish combat notifications to clients
   *
   * @param event - The combat event (CombatStartEvent or CombatEndEvent)
   * @param messages - Formatted messages for each recipient
   */
  async publishCombatNotifications(
    event: GameEvent,
    messages: Array<{
      teamId: string;
      userId: string;
      name: string;
      message: string;
      role: 'attacker' | 'defender' | 'observer';
      blocks?: Array<Record<string, unknown>>;
    }>,
  ): Promise<void> {
    await this.bridge.publishCombatNotifications(event, messages);
  }

  async publishPlayerNotification(
    event: GameEvent,
    recipients: NotificationRecipient[],
  ): Promise<void> {
    await this.bridge.publishNotification({
      type: 'player',
      recipients,
      event,
    });
  }

  async publishNotification(message: NotificationMessage): Promise<void> {
    await this.bridge.publishNotification(message);
  }
}
