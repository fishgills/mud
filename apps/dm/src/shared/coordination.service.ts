import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';
import { env } from '../env';

@Injectable()
export class CoordinationService implements OnModuleDestroy {
  private readonly logger = new Logger(CoordinationService.name);
  private client: RedisClientType | null = null;
  private readonly enabled: boolean;
  private readonly prefix: string;

  constructor() {
    this.enabled = !!env.REDIS_URL;
    this.prefix = env.COORDINATION_PREFIX;
    if (this.enabled) {
      this.client = createClient({ url: env.REDIS_URL });
      this.client.on('error', (err: unknown) => {
        const e = err as Error;
        this.logger.error(`Redis client error: ${e?.message ?? String(err)}`);
      });
      this.client
        .connect()
        .then(() => this.logger.log('Connected to Redis (coordination)'))
        .catch((err: unknown) => {
          const e = err as Error;
          this.logger.error(
            `Failed to connect to Redis (coordination): ${e?.message ?? String(err)}`,
          );
        });
    } else {
      this.logger.warn(
        'REDIS_URL not set; coordination disabled (falling back to no-op)',
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled && !!this.client;
  }

  private k(key: string): string {
    return `${this.prefix}${key}`;
  }

  async exists(key: string): Promise<boolean> {
    if (!this.isEnabled() || !this.client) return false;
    try {
      const n = await this.client.exists(this.k(key));
      return n > 0;
    } catch (e: unknown) {
      this.logger.warn(
        `Coordination exists failed for ${key}: ${(e as Error)?.message ?? e}`,
      );
      return false;
    }
  }

  /**
   * Try to acquire a lock using SET NX with TTL. Returns the token if acquired, otherwise null.
   */
  async acquireLock(
    key: string,
    token: string,
    ttlMs: number,
  ): Promise<string | null> {
    if (!this.isEnabled() || !this.client) return null;
    try {
      const res = await this.client.set(this.k(key), token, {
        NX: true,
        PX: ttlMs,
      });
      return res === 'OK' ? token : null;
    } catch (e: unknown) {
      this.logger.warn(`Acquire lock failed for ${key}: ${(e as Error)?.message ?? e}`);
      return null;
    }
  }

  /**
   * Release the lock only if we still own it (value matches token). Returns true if released.
   */
  async releaseLock(key: string, token: string): Promise<boolean> {
    if (!this.isEnabled() || !this.client) return false;
    const lua = `
      if redis.call('get', KEYS[1]) == ARGV[1] then
        return redis.call('del', KEYS[1])
      else
        return 0
      end
    `;
    try {
      const res = (await this.client.eval(lua, {
        keys: [this.k(key)],
        arguments: [token],
      })) as number;
      return res > 0;
    } catch (e: unknown) {
      this.logger.warn(`Release lock failed for ${key}: ${(e as Error)?.message ?? e}`);
      return false;
    }
  }

  async setCooldown(key: string, ttlMs: number): Promise<void> {
    if (!this.isEnabled() || !this.client) return;
    try {
      await this.client.set(this.k(key), '1', { PX: ttlMs });
    } catch (e: unknown) {
      this.logger.warn(`Set cooldown failed for ${key}: ${(e as Error)?.message ?? e}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // ignore
      }
    }
  }
}
