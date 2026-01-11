import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisEventBridge } from '@mud/redis-client';
import { GuildShopRotationService } from './guild-shop-rotation.service';
import { env } from '../../env';

@Injectable()
export class GuildShopRotationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuildShopRotationScheduler.name);
  private bridge: RedisEventBridge;

  constructor(private readonly rotationService: GuildShopRotationService) {
    this.bridge = new RedisEventBridge({
      redisUrl: env.REDIS_URL,
      channelPrefix: 'game',
      enableLogging: env.isProduction === false,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.bridge.connect();

    // Subscribe to tick events via Redis
    await this.bridge.subscribeToEvents(
      'game:world:time:tick',
      async (channel, event) => {
        if (event.eventType === 'world:time:tick') {
          const result = await this.rotationService.rotateIfDue('tick');
          if (result.rotated) {
            this.logger.debug(
              `Guild shop rotation complete via Redis tick (items=${result.items ?? 0})`,
            );
          }
        }
      },
    );

    this.logger.log(
      '✅ Guild shop rotation scheduler subscribed to Redis ticks',
    );
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.bridge.disconnect();
    } catch (error) {
      this.logger.error('Error disconnecting Redis bridge', error as Error);
    }
  }
}
