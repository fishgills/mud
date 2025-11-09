/**
 * Notification Service - Subscribes to Redis events and sends Slack notifications
 *
 * This service receives combat notifications, player events, and other game events
 * from the DM service via Redis Pub/Sub and delivers them to Slack users.
 */

import { RedisEventBridge, NotificationMessage } from '@mud/redis-client';
import { env } from './env';
import type { InstallationStore, InstallationQuery } from '@slack/oauth';
import { WebClient } from '@slack/web-api';
import { createLogger } from '@mud/logging';

interface NotificationServiceOptions {
  installationStore?: InstallationStore;
  fallbackBotToken?: string | null;
}

export class NotificationService {
  private bridge: RedisEventBridge;
  private readonly options: NotificationServiceOptions;
  private readonly webClients = new Map<string, WebClient>();
  private readonly logger = createLogger('slack:notifications');

  constructor(options: NotificationServiceOptions = {}) {
    this.options = options;
    this.bridge = new RedisEventBridge({
      redisUrl: env.REDIS_URL,
      channelPrefix: 'game',
      enableLogging: true,
    });
  }

  /**
   * Start the notification service and subscribe to events
   */
  async start(): Promise<void> {
    await this.bridge.connect();

    // Subscribe to Slack-specific notifications
    await this.bridge.subscribeToNotifications(
      'slack',
      async (notification) => {
        await this.handleNotification(notification);
      },
    );

    this.logger.info(
      '✅ Notification Service started - listening for game events',
    );
  }

  /**
   * Stop the notification service
   */
  async stop(): Promise<void> {
    await this.bridge.disconnect();
  }

  /**
   * Handle incoming notification from Redis
   */
  private async handleNotification(
    notification: NotificationMessage,
  ): Promise<void> {
    // High-level receipt log
    this.logger.info(
      {
        type: notification.type,
        recipients: notification.recipients.length,
      },
      'Received notification',
    );

    // Debug: show a sanitized notification summary
    try {
      const safePreview = (text?: string | null) => {
        if (!text) return '';
        const s = String(text).replace(/\s+/g, ' ').trim();
        return s.length > 160 ? `${s.slice(0, 157)}...` : s;
      };

      this.logger.debug(
        {
          type: notification.type,
          recipients: notification.recipients.length,
          firstMessage: notification.recipients[0]
            ? safePreview(notification.recipients[0].message)
            : null,
        },
        'notification.preview',
      );
    } catch (e) {
      // non-fatal logging helper error
      this.logger.debug(
        { error: e },
        'Failed to produce notification preview',
      );
    }

    // Send message to each recipient
    for (const recipient of notification.recipients) {
      if (recipient.clientType !== 'slack') {
        this.logger.debug(
          { clientType: recipient.clientType },
          'Skipping non-slack recipient',
        );
        continue;
      }
      try {
        this.logger.debug(
          {
            teamId: recipient.teamId,
            userId: recipient.userId,
            role: recipient.role || 'participant',
            priority: recipient.priority || 'normal',
            hasBlocks:
              Array.isArray(recipient.blocks) && recipient.blocks.length > 0,
          },
          'Processing recipient',
        );

        // Open DM channel with user
        this.logger.debug(
          { teamId: recipient.teamId, userId: recipient.userId },
          'Opening DM with user',
        );
        // Resolve bot credentials for the slack user so we can call the
        // Web API with the correct bot token for that user's workspace.
        // Resolve bot credentials for the slack user. In tests or local runs
        // we may be using the MemoryInstallationStore which doesn't persist
        // installation rows in the DB. To ensure notifications still work in
        // those situations, fall back to the globally configured
        // SLACK_BOT_TOKEN from env when a user-scoped bot token isn't found.
        const { token: botToken, fromFallback } = await this.resolveBotToken(
          recipient.teamId,
          recipient.userId,
        );
        if (!botToken) {
          this.logger.error(
            {
              teamId: recipient.teamId,
              userId: recipient.userId,
            },
            'No bot credentials or fallback SLACK_BOT_TOKEN available; cannot send notification',
          );
          continue;
        }

        if (fromFallback) {
          this.logger.debug(
            { teamId: recipient.teamId, userId: recipient.userId },
            'Using fallback bot token for notification',
          );
        }

        const web = this.getOrCreateWebClient(botToken);
        const dm = await web.conversations.open({ users: recipient.userId });

        // Log DM open response shape minimally
        try {
          this.logger.debug(
            {
              ok: Boolean(dm.ok),
              channelId: dm.channel?.id || null,
              is_im: dm.channel?.is_im || null,
            },
            'dm.open response',
          );
        } catch (e) {
          this.logger.debug({ error: e }, 'Failed to log dm.open response');
        }

        const channelId = dm.channel?.id;
        if (!channelId) {
          this.logger.error(
            { teamId: recipient.teamId, userId: recipient.userId },
            'Could not open DM; no channel ID returned',
          );
          continue;
        }

        // Send the message. Prefer provided blocks (rich content) if available.
        const hasBlocks =
          Array.isArray(recipient.blocks) && recipient.blocks.length > 0;
        if (hasBlocks) {
          const blocksCount = Array.isArray(recipient.blocks)
            ? recipient.blocks.length
            : 0;
          this.logger.debug(
            {
              channel: channelId,
              textPreview:
                typeof recipient.message === 'string' &&
                recipient.message.length > 120
                  ? `${recipient.message.slice(0, 117)}...`
                  : recipient.message,
              blocksCount,
            },
            'Posting message with blocks',
          );
          await web.chat.postMessage({
            channel: channelId,
            text: recipient.message,
            blocks: (recipient.blocks || []) as unknown as (
              | import('@slack/types').KnownBlock
              | import('@slack/types').Block
            )[],
          });
        } else {
          // Add a minimal block wrapper for high-priority messages when no blocks provided
          const textPreview =
            typeof recipient.message === 'string' &&
            recipient.message.length > 120
              ? `${recipient.message.slice(0, 117)}...`
              : recipient.message;

          this.logger.debug(
            {
              channel: channelId,
              textPreview,
              hasBlocks: recipient.priority === 'high',
            },
            'Posting message without blocks',
          );
          await web.chat.postMessage({
            channel: channelId,
            text: recipient.message,
            ...(recipient.priority === 'high' && {
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `⚔️ *${notification.type.toUpperCase()}*\n\n${recipient.message}`,
                  },
                },
              ],
            }),
          });
        }

        this.logger.info(
          {
            teamId: recipient.teamId,
            userId: recipient.userId,
            role: recipient.role || 'participant',
            notificationType: notification.type,
          },
          '✅ Sent notification',
        );
      } catch (error) {
        // Provide stack-aware debug for errors
        // Log error object for debugging; stringify may fail on circulars so pass as-is
        this.logger.error(
          {
            teamId: recipient.teamId,
            userId: recipient.userId,
            error,
          },
          'Error sending notification',
        );
      }
    }
  }

  private async resolveBotToken(
    teamId: string | null,
    userId: string | null,
  ): Promise<{
    token: string | null;
    fromFallback: boolean;
  }> {
    const fallback =
      this.options.fallbackBotToken ?? env.SLACK_BOT_TOKEN ?? null;
    const store = this.options.installationStore;

    if (!store) {
      return { token: fallback, fromFallback: true };
    }

    try {
      const query = {
        userId,
        teamId: teamId ?? undefined,
        enterpriseId: undefined,
        isEnterpriseInstall: false,
      } as unknown as InstallationQuery<false>;
      const installation = await store.fetchInstallation(query);
      const token = installation.bot?.token ?? installation.user?.token ?? null;
      if (token) {
        return { token, fromFallback: false };
      }
      this.logger.warn(
        { teamId, userId },
        'Installation missing bot token; falling back to env token',
      );
    } catch (error) {
      this.logger.warn(
        { teamId, userId, error },
        'Failed to fetch installation; falling back to env token',
      );
    }

    return { token: fallback, fromFallback: true };
  }

  private getOrCreateWebClient(token: string): WebClient {
    const cached = this.webClients.get(token);
    if (cached) return cached;
    this.logger.debug(
      { tokenPreview: token.slice(0, 8) },
      'Creating WebClient for notification service',
    );
    const client = new WebClient(token);
    this.webClients.set(token, client);
    return client;
  }
}
