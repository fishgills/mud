/**
 * Redis Event Bridge - Bridges in-memory EventBus to Redis Pub/Sub
 *
 * This allows events to be broadcast across services (DM → Slack Bot, Discord Bot, etc.)
 * while keeping the EventBus pattern and making services client-agnostic.
 */

import { createClient, RedisClientType } from 'redis';
import type { GameEvent } from '@mud/engine';

export interface EventBridgeConfig {
  redisUrl: string;
  channelPrefix?: string;
  enableLogging?: boolean;
}

export interface NotificationMessage {
  type: 'combat' | 'player' | 'monster' | 'world' | 'party';
  recipients: NotificationRecipient[];
  event: GameEvent;
}

export type NotificationRecipient =
  | {
      clientType: 'slack';
      teamId: string;
      userId: string;
      message: string;
      role?: 'attacker' | 'defender' | 'observer';
      priority?: 'high' | 'normal' | 'low';
      blocks?: Array<Record<string, unknown>>;
    }
  | {
      clientType: 'discord' | 'web';
      teamId: undefined;
      userId: string; // e.g., "discord:987654"
      message: string;
      role?: 'attacker' | 'defender' | 'observer';
      priority?: 'high' | 'normal' | 'low';
      blocks?: Array<Record<string, unknown>>;
    };

/**
 * Redis Event Bridge - publishes game events to Redis for cross-service communication
 */
export class RedisEventBridge {
  private publisherClient: RedisClientType;
  private subscriberClient: RedisClientType | null = null;
  private channelPrefix: string;
  private enableLogging: boolean;
  private isConnected = false;

  constructor(config: EventBridgeConfig) {
    this.channelPrefix = config.channelPrefix || 'game';
    this.enableLogging = config.enableLogging ?? false;

    this.publisherClient = createClient({
      url: config.redisUrl,
    }) as RedisClientType;

    this.publisherClient.on('error', (err) => {
      console.error('Redis Event Bridge Publisher Error:', err);
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    await this.publisherClient.connect();
    this.isConnected = true;

    if (this.enableLogging) {
      console.log('✅ Redis Event Bridge connected');
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return;
    }

    await this.publisherClient.quit();

    if (this.subscriberClient) {
      await this.subscriberClient.quit();
    }

    this.isConnected = false;

    if (this.enableLogging) {
      console.log('👋 Redis Event Bridge disconnected');
    }
  }

  /**
   * Publish a game event to Redis
   */
  async publishEvent(event: GameEvent): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis Event Bridge not connected');
    }

    // Convert event type to channel name: player:move → game:player:move
    const channel = `${this.channelPrefix}:${event.eventType}`;
    const message = JSON.stringify(event);

    await this.publisherClient.publish(channel, message);

    if (this.enableLogging) {
      console.log(`📤 Published event to ${channel}:`, event.eventType);
    }
  }

  /**
   * Publish a notification message to a client-specific channel
   * This is for routing formatted messages to specific clients
   */
  async publishNotification(notification: NotificationMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis Event Bridge not connected');
    }

    // Group recipients by client type for efficient publishing
    const recipientsByType = notification.recipients.reduce(
      (acc, recipient) => {
        if (!acc[recipient.clientType]) {
          acc[recipient.clientType] = [];
        }
        acc[recipient.clientType].push(recipient);
        return acc;
      },
      {} as Record<string, NotificationRecipient[]>,
    );

    // Publish to client-specific channels
    for (const [clientType, recipients] of Object.entries(recipientsByType)) {
      const channel = `notifications:${clientType}`;
      const message = JSON.stringify({
        type: notification.type,
        event: notification.event,
        recipients,
        timestamp: new Date().toISOString(),
      } satisfies Record<string, unknown>);

      await this.publisherClient.publish(channel, message);

      if (this.enableLogging) {
        console.log(
          `📤 Published ${recipients.length} notifications to ${channel}`,
        );
      }
    }
  }

  /**
   * Subscribe to game events (for services that need to react to events)
   */
  async subscribeToEvents(
    pattern: string,
    callback: (channel: string, event: GameEvent) => void | Promise<void>,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis Event Bridge not connected');
    }

    // Create a separate client for subscribing (Redis requirement)
    if (!this.subscriberClient) {
      this.subscriberClient =
        this.publisherClient.duplicate() as RedisClientType;
      await this.subscriberClient.connect();
    }

    await this.subscriberClient.pSubscribe(
      pattern,
      async (message, channel) => {
        try {
          const event = JSON.parse(message) as GameEvent;
          await callback(channel, event);
        } catch (err: unknown) {
          console.error(`Error processing event from ${channel}:`, err);
        }
      },
    );

    if (this.enableLogging) {
      console.log(`👂 Subscribed to pattern: ${pattern}`);
    }
  }

  /**
   * Subscribe to notification messages (for client services like Slack bot)
   */
  async subscribeToNotifications(
    clientType: 'slack' | 'discord' | 'web',
    callback: (notification: NotificationMessage) => void | Promise<void>,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis Event Bridge not connected');
    }

    // Create a separate client for subscribing
    if (!this.subscriberClient) {
      this.subscriberClient =
        this.publisherClient.duplicate() as RedisClientType;
      await this.subscriberClient.connect();
    }

    const channel = `notifications:${clientType}`;

    await this.subscriberClient.subscribe(channel, async (message) => {
      try {
        const notification = JSON.parse(message) as NotificationMessage;
        await callback(notification);
      } catch (err: unknown) {
        console.error(`Error processing notification from ${channel}:`, err);
      }
    });

    if (this.enableLogging) {
      console.log(`👂 Subscribed to notifications: ${channel}`);
    }
  }

  /**
   * Helper: Publish combat notifications with proper formatting
   */
  async publishCombatNotifications(
    event: GameEvent,
    messages: Array<{
      name: string;
      message: string;
      teamId: string;
      userId: string;
      role: 'attacker' | 'defender' | 'observer';
      blocks?: Array<Record<string, unknown>>;
    }>,
  ): Promise<void> {
    const recipients: NotificationRecipient[] = messages.map((msg) => ({
      clientType: 'slack' as const,
      teamId: msg.teamId,
      userId: msg.userId,
      message: msg.message,
      role: msg.role,
      priority: msg.role === 'observer' ? 'normal' : 'high',
      blocks: msg.blocks,
    }));

    await this.publishNotification({
      type: 'combat',
      recipients,
      event,
    });
  }
}
