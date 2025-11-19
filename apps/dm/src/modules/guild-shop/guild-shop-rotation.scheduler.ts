import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBus } from '../../shared/event-bus';
import { GuildShopRotationService } from './guild-shop-rotation.service';

@Injectable()
export class GuildShopRotationScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuildShopRotationScheduler.name);
  private unsubscribe?: () => void;

  constructor(private readonly rotationService: GuildShopRotationService) {}

  onModuleInit(): void {
    this.unsubscribe = EventBus.on('world:time:tick', async () => {
      const result = await this.rotationService.rotateIfDue('tick');
      if (result.rotated) {
        this.logger.debug(
          `Guild shop rotation complete via scheduler (items=${result.items ?? 0})`,
        );
      }
    });
  }

  onModuleDestroy(): void {
    try {
      this.unsubscribe?.();
    } catch (error) {
      this.logger.error(
        'Error unsubscribing shop rotation listener',
        error as Error,
      );
    }
    this.unsubscribe = undefined;
  }
}
