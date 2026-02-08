/**
 * Notification Service - Subscribes to Redis events and sends Slack notifications
 *
 * This service receives combat notifications, player events, and other game events
 * from the DM service via Redis Pub/Sub and delivers them to Slack users.
 */

import { RedisEventBridge, NotificationMessage } from '@mud/redis-client';
import { env } from './env';
import type { InstallationStore, InstallationQuery } from '@slack/oauth';
import { Logger, WebClient } from '@slack/web-api';
import { GuildCrierService } from './services/guild-crier.service';
import {
  formatSlackErrorData,
  formatSlackResponseMetadata,
} from './handlers/errorUtils';
import { truncateSlackPayload } from './utils/slackPayload';

interface NotificationServiceOptions {
  installationStore?: InstallationStore;
  fallbackBotToken?: string | null;
  logger: Logger;
  guildCrierService?: GuildCrierService;
}

type NotificationRecipient = NotificationMessage['recipients'][number];
type SlackNotificationRecipient = Extract<
  NotificationRecipient,
  { clientType: 'slack' }
>;

export class NotificationService {
  private static readonly MAX_PARALLEL_RECIPIENTS = 5;
  private bridge: RedisEventBridge;
  private readonly options: NotificationServiceOptions;
  private readonly webClients = new Map<string, WebClient>();
  private readonly botTokenCache = new Map<
    string,
    { token: string | null; fromFallback: boolean }
  >();
  private readonly dmChannelCache = new Map<string, string>();
  private readonly guildCrier?: GuildCrierService;

  constructor(options: NotificationServiceOptions) {
    this.options = options;
    this.guildCrier = options.guildCrierService;
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

    this.options.logger.info(
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
    this.options.logger.info(
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

      this.options.logger.debug(
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
      this.options.logger.debug(
        { error: e },
        'Failed to produce notification preview',
      );
    }

    const slackRecipients = notification.recipients.filter(
      (recipient): recipient is SlackNotificationRecipient =>
        recipient.clientType === 'slack',
    );

    for (
      let index = 0;
      index < slackRecipients.length;
      index += NotificationService.MAX_PARALLEL_RECIPIENTS
    ) {
      const batch = slackRecipients.slice(
        index,
        index + NotificationService.MAX_PARALLEL_RECIPIENTS,
      );
      await Promise.all(
        batch.map((recipient) =>
          this.deliverToRecipient(notification, recipient),
        ),
      );
    }
  }

  private async deliverToRecipient(
    notification: NotificationMessage,
    recipient: SlackNotificationRecipient,
  ): Promise<void> {
    try {
      this.options.logger.debug(
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

      const { token: botToken, fromFallback } = await this.resolveBotToken(
        recipient.teamId,
        recipient.userId,
      );
      if (!botToken) {
        this.options.logger.error(
          {
            teamId: recipient.teamId,
            userId: recipient.userId,
          },
          'No bot credentials or fallback SLACK_BOT_TOKEN available; cannot send notification',
        );
        return;
      }

      if (fromFallback) {
        this.options.logger.debug(
          { teamId: recipient.teamId, userId: recipient.userId },
          'Using fallback bot token for notification',
        );
      }

      const web = this.getOrCreateWebClient(botToken);
      const channelId = await this.getOrOpenDmChannel(
        web,
        botToken,
        recipient.userId,
      );
      if (!channelId) {
        this.options.logger.error(
          { teamId: recipient.teamId, userId: recipient.userId },
          'Could not open DM; no channel ID returned',
        );
        return;
      }

      let finalMessage = recipient.message;
      let finalBlocks = recipient.blocks;
      if (this.guildCrier) {
        try {
          const override = this.guildCrier.formatRecipient(
            notification,
            recipient,
          );
          if (override) {
            finalMessage = override.message;
            finalBlocks = override.blocks;
          }
        } catch (error) {
          this.options.logger.debug(
            { error },
            'guild-crier formatting failed; using original payload',
          );
        }
      }

      const truncated = truncateSlackPayload(finalMessage, finalBlocks);
      finalMessage = truncated.text;
      finalBlocks = truncated.blocks;

      if (Array.isArray(finalBlocks) && finalBlocks.length > 0) {
        this.options.logger.debug(
          {
            channel: channelId,
            textPreview:
              typeof finalMessage === 'string' && finalMessage.length > 120
                ? `${finalMessage.slice(0, 117)}...`
                : finalMessage,
            blocksCount: finalBlocks.length,
          },
          'Posting message with blocks',
        );
        await web.chat.postMessage({
          channel: channelId,
          text: finalMessage,
          blocks: (finalBlocks || []) as unknown as (
            | import('@slack/types').KnownBlock
            | import('@slack/types').Block
          )[],
        });
      } else {
        const textPreview =
          typeof finalMessage === 'string' && finalMessage.length > 120
            ? `${finalMessage.slice(0, 117)}...`
            : finalMessage;
        this.options.logger.debug(
          {
            channel: channelId,
            textPreview,
            hasBlocks: recipient.priority === 'high',
          },
          'Posting message without blocks',
        );
        await web.chat.postMessage({
          channel: channelId,
          text: finalMessage,
          ...(recipient.priority === 'high' && {
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `⚔️ *${notification.type.toUpperCase()}*\n\n${finalMessage}`,
                },
              },
            ],
          }),
        });
      }

      this.options.logger.info(
        {
          teamId: recipient.teamId,
          userId: recipient.userId,
          role: recipient.role || 'participant',
          notificationType: notification.type,
        },
        '✅ Sent notification',
      );
    } catch (error) {
      const errorData = formatSlackErrorData(error);
      const responseMetadata = formatSlackResponseMetadata(error);
      this.options.logger.error(
        {
          teamId: recipient.teamId,
          userId: recipient.userId,
          error,
          ...(errorData ? { errorData } : {}),
          ...(responseMetadata ? { responseMetadata } : {}),
        },
        'Error sending notification',
      );
    }
  }

  private async resolveBotToken(
    teamId: string | null | undefined,
    userId: string | null | undefined,
  ): Promise<{
    token: string | null;
    fromFallback: boolean;
  }> {
    const cacheKey = this.getBotTokenCacheKey(teamId, userId);
    const cached = this.botTokenCache.get(cacheKey);
    if (cached) return cached;

    const fallback =
      this.options.fallbackBotToken ?? env.SLACK_BOT_TOKEN ?? null;
    const store = this.options.installationStore;

    if (!store) {
      const result = { token: fallback, fromFallback: true };
      this.botTokenCache.set(cacheKey, result);
      return result;
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
        const result = { token, fromFallback: false };
        this.botTokenCache.set(cacheKey, result);
        return result;
      }
      this.options.logger.warn(
        { teamId, userId },
        'Installation missing bot token; falling back to env token',
      );
    } catch (error) {
      this.options.logger.warn(
        { teamId, userId, error },
        'Failed to fetch installation; falling back to env token',
      );
    }

    const result = { token: fallback, fromFallback: true };
    this.botTokenCache.set(cacheKey, result);
    return result;
  }

  private getBotTokenCacheKey(
    teamId: string | null | undefined,
    userId: string | null | undefined,
  ): string {
    if (teamId) return `team:${teamId}`;
    return `user:${userId ?? 'unknown'}`;
  }

  private getOrCreateWebClient(token: string): WebClient {
    const cached = this.webClients.get(token);
    if (cached) return cached;
    this.options.logger.debug(
      { tokenPreview: token.slice(0, 8) },
      'Creating WebClient for notification service',
    );
    const client = new WebClient(token);
    this.webClients.set(token, client);
    return client;
  }

  private async getOrOpenDmChannel(
    web: WebClient,
    botToken: string,
    userId: string,
  ): Promise<string | undefined> {
    const cacheKey = `${botToken}:${userId}`;
    const cached = this.dmChannelCache.get(cacheKey);
    if (cached) return cached;

    this.options.logger.debug({ userId }, 'Opening DM with user');
    const dm = await web.conversations.open({ users: userId });

    try {
      this.options.logger.debug(
        {
          ok: Boolean(dm.ok),
          channelId: dm.channel?.id || null,
          is_im: dm.channel?.is_im || null,
        },
        'dm.open response',
      );
    } catch (error) {
      this.options.logger.debug({ error }, 'Failed to log dm.open response');
    }

    const channelId =
      typeof dm.channel?.id === 'string' ? dm.channel.id : undefined;
    if (channelId) {
      this.dmChannelCache.set(cacheKey, channelId);
    }
    return channelId;
  }
}
