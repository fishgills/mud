import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { GuildAnnouncementsService } from './guild-announcements.service';

@Injectable()
export class GuildAnnouncementsScheduler
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(GuildAnnouncementsScheduler.name);
  private interval?: NodeJS.Timeout;
  private readonly pollIntervalMs = 60_000;

  constructor(private readonly service: GuildAnnouncementsService) {}

  onModuleInit(): void {
    const poll = async () => {
      const result = await this.service.pollNextAnnouncement('tick');
      if (result.delivered) {
        this.logger.debug('Delivered guild announcement via tick trigger');
      }
    };

    void poll();
    this.interval = setInterval(() => {
      void poll();
    }, this.pollIntervalMs);
  }

  onModuleDestroy(): void {
    try {
      if (this.interval) {
        clearInterval(this.interval);
      }
    } catch (error) {
      this.logger.error('Error unsubscribing from tick events', error as Error);
    }
    this.interval = undefined;
  }
}
