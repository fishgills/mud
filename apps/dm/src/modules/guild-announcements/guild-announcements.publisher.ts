import { Injectable, Logger } from '@nestjs/common';
import type { AnnouncementRecord } from '@mud/database';
import type { GuildAnnouncementPayload } from '@mud/api-contracts';
import { withGuildLogFields } from '@mud/logging';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { EventBus } from '../../shared/event-bus';
import { GuildEventType } from '@mud/event-bus';

type Recipient = Array<{ teamId: string; userId: string }>;

interface PublishOptions {
  announcement: GuildAnnouncementPayload;
  raw: AnnouncementRecord;
  occupants: Recipient;
  digestRecipients: Recipient;
  correlationId: string;
  source: 'tick' | 'manual';
}

@Injectable()
export class GuildAnnouncementsPublisher {
  private readonly logger = new Logger(GuildAnnouncementsPublisher.name);

  constructor(private readonly eventBridge: EventBridgeService) {}

  async publish(options: PublishOptions): Promise<void> {
    const {
      announcement,
      raw,
      occupants,
      digestRecipients,
      correlationId,
      source,
    } = options;
    const timestamp = new Date();

    await Promise.all([
      this.publishToAudience(
        'guild',
        occupants,
        announcement,
        timestamp,
        correlationId,
      ),
      this.publishToAudience(
        'global',
        digestRecipients,
        announcement,
        timestamp,
        correlationId,
      ),
    ]);

    this.logger.debug(
      withGuildLogFields(
        {
          message: 'Delivered guild announcement',
          announcementId: raw.id,
          source,
          occupants: occupants.length,
          digestRecipients: digestRecipients.length,
        },
        { command: 'announce', correlationId },
      ),
    );
  }

  private async publishToAudience(
    audience: 'guild' | 'global',
    recipients: Recipient,
    announcement: GuildAnnouncementPayload,
    timestamp: Date,
    correlationId: string,
  ): Promise<void> {
    if (recipients.length === 0) return;

    const event = {
      eventType: GuildEventType.AnnouncementDelivered,
      payload: announcement,
      audience,
      timestamp,
      correlationId,
    } as const;

    await EventBus.emit(event);

    const message =
      audience === 'guild'
        ? `📣 *${announcement.title}*\n${announcement.body}`
        : `📜 ${announcement.digest}`;

    const blocks =
      audience === 'guild'
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*:scroll: Town Crier*
*${announcement.title}*
${announcement.body}`,
              },
            },
          ]
        : undefined;

    await this.eventBridge.publishNotification({
      type: 'world',
      recipients: recipients.map((recipient) => ({
        clientType: 'slack' as const,
        teamId: recipient.teamId,
        userId: recipient.userId,
        message,
        ...(blocks ? { blocks } : {}),
      })),
      event,
    });
  }
}
