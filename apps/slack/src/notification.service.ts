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

interface NotificationServiceOptions {
  installationStore?: InstallationStore;
  fallbackBotToken?: string | null;
  logger: Logger;
  guildCrierService?: GuildCrierService;
}

export class NotificationService {
  private static readonly SLACK_TEXT_LIMIT = 3000;
  private static readonly SLACK_BLOCKS_LIMIT = 50;
  private bridge: RedisEventBridge;
  private readonly options: NotificationServiceOptions;
  private readonly webClients = new Map<string, WebClient>();
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

    // Send message to each recipient
    for (const recipient of notification.recipients) {
      if (recipient.clientType !== 'slack') {
        this.options.logger.debug(
          { clientType: recipient.clientType },
          'Skipping non-slack recipient',
        );
        continue;
      }
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

        // Open DM channel with user
        this.options.logger.debug(
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
          this.options.logger.error(
            {
              teamId: recipient.teamId,
              userId: recipient.userId,
            },
            'No bot credentials or fallback SLACK_BOT_TOKEN available; cannot send notification',
          );
          continue;
        }

        if (fromFallback) {
          this.options.logger.debug(
            { teamId: recipient.teamId, userId: recipient.userId },
            'Using fallback bot token for notification',
          );
        }

        const web = this.getOrCreateWebClient(botToken);
        const dm = await web.conversations.open({ users: recipient.userId });

        // Log DM open response shape minimally
        try {
          this.options.logger.debug(
            {
              ok: Boolean(dm.ok),
              channelId: dm.channel?.id || null,
              is_im: dm.channel?.is_im || null,
            },
            'dm.open response',
          );
        } catch (e) {
          this.options.logger.debug(
            { error: e },
            'Failed to log dm.open response',
          );
        }

        const channelId = dm.channel?.id;
        if (!channelId) {
          this.options.logger.error(
            { teamId: recipient.teamId, userId: recipient.userId },
            'Could not open DM; no channel ID returned',
          );
          continue;
        }

        // Allow guild crier service to enrich the payload
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

        const truncated = this.truncateSlackPayload(finalMessage, finalBlocks);
        finalMessage = truncated.text;
        finalBlocks = truncated.blocks;

        // Send the message. Prefer provided blocks (rich content) if available.
        if (Array.isArray(finalBlocks) && finalBlocks.length > 0) {
          const blocksCount = finalBlocks.length;
          this.options.logger.debug(
            {
              channel: channelId,
              textPreview:
                typeof finalMessage === 'string' && finalMessage.length > 120
                  ? `${finalMessage.slice(0, 117)}...`
                  : finalMessage,
              blocksCount,
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
          // Add a minimal block wrapper for high-priority messages when no blocks provided
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
        // Provide stack-aware debug for errors
        // Log error object for debugging; stringify may fail on circulars so pass as-is
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

    return { token: fallback, fromFallback: true };
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

  private truncateSlackPayload(
    message: string,
    blocks?: Array<Record<string, unknown>>,
  ): { text: string; blocks?: Array<Record<string, unknown>> } {
    const text = this.truncateText(
      message,
      NotificationService.SLACK_TEXT_LIMIT,
    );
    if (!blocks || blocks.length === 0) {
      return { text };
    }
    const truncatedBlocks = this.truncateBlocks(blocks);
    return { text, blocks: truncatedBlocks };
  }

  private truncateBlocks(
    blocks: Array<Record<string, unknown>>,
  ): Array<Record<string, unknown>> {
    const limited = blocks.slice(0, NotificationService.SLACK_BLOCKS_LIMIT);
    return limited.map((block) => this.truncateBlock(block));
  }

  private truncateBlock(
    block: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...block };
    if (typeof next.text === 'string') {
      next.text = this.truncateText(
        next.text,
        NotificationService.SLACK_TEXT_LIMIT,
      );
    } else if (next.text && typeof next.text === 'object') {
      next.text = this.truncateTextObject(next.text);
    }
    if (Array.isArray(next.fields)) {
      next.fields = next.fields.map((field) => this.truncateTextObject(field));
    }
    if (Array.isArray(next.elements)) {
      next.elements = next.elements.map((element) =>
        this.truncateTextObject(element),
      );
    }
    if (next.label && typeof next.label === 'object') {
      next.label = this.truncateTextObject(next.label);
    }
    if (next.placeholder && typeof next.placeholder === 'object') {
      next.placeholder = this.truncateTextObject(next.placeholder);
    }
    return next;
  }

  private truncateTextObject(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    const record = value as Record<string, unknown>;
    if (typeof record.text === 'string') {
      return {
        ...record,
        text: this.truncateText(
          record.text,
          NotificationService.SLACK_TEXT_LIMIT,
        ),
      };
    }
    return value;
  }

  private truncateText(text: string, limit: number): string {
    if (text.length <= limit) return text;
    const suffix = '...';
    return `${text.slice(0, limit - suffix.length)}${suffix}`;
  }
}
