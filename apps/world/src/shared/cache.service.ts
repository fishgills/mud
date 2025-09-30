import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { env } from '../env';

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: RedisClientType | null = null;
  private readonly enabled: boolean;
  private readonly prefix: string;

  constructor() {
    this.enabled = !!env.REDIS_URL;
    this.prefix = env.CACHE_PREFIX;
    if (this.enabled) {
      this.client = createClient({ url: env.REDIS_URL });
      this.client.on('error', (err: unknown) => {
        const e: any = err as any;
        this.logger.error(`Redis client error: ${e?.message ?? String(err)}`);
      });
      // Connect lazily; establish connection immediately here to fail fast in prod
      this.client
        .connect()
        .then(() => this.logger.log('Connected to Redis'))
        .catch((err: unknown) => {
          const e: any = err as any;
          this.logger.error(
            `Failed to connect to Redis: ${e?.message ?? String(err)}`,
          );
        });
    } else {
      this.logger.warn(
        'REDIS_URL not set; cache disabled (falling back to no-op)',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && !!this.client;
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<string | null> {
    if (!this.isEnabled() || !this.client) return null;
    try {
      return await this.client.get(this.k(key));
    } catch (e: any) {
      this.logger.warn(`Cache get failed for ${key}: ${e?.message ?? e}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (!this.isEnabled() || !this.client) return;
    try {
      // Set with PX (milliseconds) expiry
      await this.client.set(this.k(key), value, { PX: ttlMs });
    } catch (e: any) {
      this.logger.warn(`Cache set failed for ${key}: ${e?.message ?? e}`);
    }
  }

  /** Delete all keys under the configured cache prefix. Returns number of keys removed. */
  async clearAll(): Promise<number> {
    return this.deleteByPattern('*');
  }

  /** Delete keys under the configured prefix matching the provided suffix glob pattern. */
  async clearPattern(suffixPattern: string): Promise<number> {
    const pat =
      suffixPattern && suffixPattern.trim().length > 0 ? suffixPattern : '*';
    return this.deleteByPattern(pat);
  }

  private async deleteByPattern(suffixPattern: string): Promise<number> {
    if (!this.isEnabled() || !this.client) return 0;
    const match = `${this.prefix}${suffixPattern}`;
    let deleted = 0;
    const batch: string[] = [];
    const flush = async () => {
      if (batch.length === 0) return;
      try {
        const n = await this.client!.del(batch);
        deleted += n;
      } catch (err) {
        const e: any = err as any;
        this.logger.warn(
          `Cache delete failed for batch: ${e?.message ?? String(err)}`,
        );
      } finally {
        batch.length = 0;
      }
    };
    try {
      for await (const key of this.client.scanIterator({
        MATCH: match,
        COUNT: 1000,
      })) {
        const keys = Array.isArray(key) ? key : [key];
        for (const currentKey of keys) {
          batch.push(String(currentKey));
          if (batch.length >= 500) {
            await flush();
          }
        }
      }
      await flush();
    } catch (err) {
      const e: any = err as any;
      this.logger.warn(
        `Cache scan/delete failed: ${e?.message ?? String(err)}`,
      );
    }
    return deleted;
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch (e) {
        // ignore
      }
    }
  }
}
