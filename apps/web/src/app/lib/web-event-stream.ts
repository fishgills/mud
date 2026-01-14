import 'server-only';

import { RedisEventBridge, type NotificationMessage } from '@mud/redis-client';

type NotificationListener = (notification: NotificationMessage) => void;

class WebEventStream {
  private readonly bridge: RedisEventBridge;
  private readonly listeners = new Set<NotificationListener>();
  private started = false;
  private starting: Promise<void> | null = null;

  constructor(redisUrl: string) {
    this.bridge = new RedisEventBridge({
      redisUrl,
      channelPrefix: 'game',
      enableLogging: false,
    });
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    if (!this.starting) {
      this.starting = this.initialize();
    }

    await this.starting;
  }

  subscribe(listener: NotificationListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private async initialize(): Promise<void> {
    await this.bridge.connect();
    await this.bridge.subscribeToNotifications('web', async (notification) => {
      for (const listener of this.listeners) {
        try {
          await listener(notification);
        } catch {
          // Avoid breaking the stream on listener errors.
        }
      }
    });
    this.started = true;
  }
}

const globalForWebEvents = globalThis as typeof globalThis & {
  __webEventStream?: WebEventStream;
};

export const getWebEventStream = (): WebEventStream => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is not set');
  }

  if (!globalForWebEvents.__webEventStream) {
    globalForWebEvents.__webEventStream = new WebEventStream(redisUrl);
  }

  return globalForWebEvents.__webEventStream;
};
