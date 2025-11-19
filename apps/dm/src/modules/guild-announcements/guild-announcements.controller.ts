import { Body, Controller, Post } from '@nestjs/common';
import { GuildAnnouncementsService } from './guild-announcements.service';
import type {
  GuildAnnouncementPollRequest,
  GuildAnnouncementPollResponse,
} from '@mud/api-contracts';

@Controller('guild/announcements')
export class GuildAnnouncementsController {
  constructor(private readonly service: GuildAnnouncementsService) {}

  @Post('next')
  async poll(
    @Body() body: GuildAnnouncementPollRequest,
  ): Promise<GuildAnnouncementPollResponse> {
    const result = await this.service.pollNextAnnouncement('manual', body);
    return {
      announced: result.delivered,
      announcement: result.announcement
        ? {
            id: result.announcement.id.toString(),
            title: result.announcement.title,
            body: result.announcement.body,
            digest: result.announcement.digest,
            priority: result.announcement.priority,
            visibleUntil: result.announcement.visibleUntil?.toISOString(),
          }
        : undefined,
      correlationId: result.correlationId,
    };
  }
}
