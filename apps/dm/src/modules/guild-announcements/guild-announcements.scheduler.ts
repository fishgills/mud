import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBus } from '../../shared/event-bus';
import { GuildAnnouncementsService } from './guild-announcements.service';

@Injectable()
export class GuildAnnouncementsScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuildAnnouncementsScheduler.name);
  private unsubscribe?: () => void;

  constructor(private readonly service: GuildAnnouncementsService) {}

  onModuleInit(): void {
    this.unsubscribe = EventBus.on('world:time:tick', async () => {
      const result = await this.service.pollNextAnnouncement('tick');
      if (result.delivered) {
        this.logger.debug('Delivered guild announcement via tick trigger');
      }
    });
  }

  onModuleDestroy(): void {
    try {
      this.unsubscribe?.();
    } catch (error) {
      this.logger.error('Error unsubscribing from tick events', error as Error);
    }
    this.unsubscribe = undefined;
  }
}
