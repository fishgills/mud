import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { GuildShopRotationService } from './guild-shop-rotation.service';
import { env } from '../../env';

@Injectable()
export class GuildShopRotationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuildShopRotationScheduler.name);
  private interval?: NodeJS.Timeout;
  private readonly pollIntervalMs = Math.min(
    60_000,
    env.GUILD_SHOP_ROTATION_INTERVAL_MS,
  );

  constructor(private readonly rotationService: GuildShopRotationService) {}

  async onModuleInit(): Promise<void> {
    const rotate = async () => {
      const result = await this.rotationService.rotateIfDue('tick');
      if (result.rotated) {
        this.logger.debug(
          `Guild shop rotation complete (items=${result.items ?? 0})`,
        );
      }
    };

    void rotate();
    this.interval = setInterval(() => {
      void rotate();
    }, this.pollIntervalMs);

    this.logger.log('✅ Guild shop rotation scheduler started');
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.interval) {
        clearInterval(this.interval);
      }
    } catch (error) {
      this.logger.error('Error stopping guild shop rotation scheduler', error);
    }
    this.interval = undefined;
  }
}
