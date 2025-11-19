import type {
  NotificationMessage,
  NotificationRecipient,
} from '@mud/redis-client';

type SlackRecipient = Extract<NotificationRecipient, { clientType: 'slack' }>;

type GuildAnnouncementEvent = Extract<
  NotificationMessage['event'],
  { eventType: 'guild.announcement.delivered' }
>;

const isGuildAnnouncementEvent = (
  event: NotificationMessage['event'],
): event is GuildAnnouncementEvent =>
  event?.eventType === 'guild.announcement.delivered';

export class GuildCrierService {
  constructor(
    private readonly logger?: {
      debug: (message?: unknown, ...optional: unknown[]) => void;
    },
  ) {}

  formatRecipient(
    notification: NotificationMessage,
    recipient: SlackRecipient,
  ): { message: string; blocks?: Array<Record<string, unknown>> } | null {
    if (!isGuildAnnouncementEvent(notification.event)) {
      return null;
    }
    if (recipient.clientType !== 'slack') {
      return null;
    }

    const { payload, audience } = notification.event;
    const message =
      audience === 'guild'
        ? `📣 *${payload.title}*\n${payload.body}`
        : `📜 ${payload.digest}`;

    if (audience === 'guild') {
      const blocks = [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: 'Town Crier',
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*:scroll: ${payload.title}*`,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: payload.body,
          },
        },
      ];
      this.logger?.debug(
        { audience, announcementId: payload.id },
        'guild.crier.formatted',
      );
      return { message, blocks };
    }

    // Digest recipients receive a compact section
    const digestBlocks = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*:scroll: Guild Digest* – ${payload.digest}`,
        },
      },
    ];

    this.logger?.debug(
      { audience, announcementId: payload.id },
      'guild.crier.formatted',
    );
    return { message, blocks: digestBlocks };
  }
}
