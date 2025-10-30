/**
 * Notification Service - Subscribes to Redis events and sends Slack notifications
 *
 * This service receives combat notifications, player events, and other game events
 * from the DM service via Redis Pub/Sub and delivers them to Slack users.
 */

import { RedisEventBridge, NotificationMessage } from '@mud/redis-client';
import {
  getCredentialsForSlackUser,
  getWebClientForToken,
} from './utils/authorize';
import { env } from './env';

export class NotificationService {
  private bridge: RedisEventBridge;

  constructor() {
    this.bridge = new RedisEventBridge({
      redisUrl: env.REDIS_URL,
      channelPrefix: 'game',
      enableLogging: env.isProduction === false,
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

    console.log('✅ Notification Service started - listening for game events');
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
    console.info(
      `📨 Received ${notification.type} notification for ${notification.recipients.length} recipients`,
    );

    // Debug: show a sanitized notification summary
    try {
      const safePreview = (text?: string | null) => {
        if (!text) return '';
        const s = String(text).replace(/\s+/g, ' ').trim();
        return s.length > 160 ? `${s.slice(0, 157)}...` : s;
      };

      console.debug('notification.preview:', {
        type: notification.type,
        recipients: notification.recipients.length,
        // preview first recipient message for quick triage
        firstMessage: notification.recipients[0]
          ? safePreview(notification.recipients[0].message)
          : null,
      });
    } catch (e) {
      // non-fatal logging helper error
      console.debug('Failed to produce notification preview', e);
    }

    // Send message to each recipient
    for (const recipient of notification.recipients) {
      try {
        console.debug('processing recipient:', {
          clientId: recipient.clientId,
          role: recipient.role || 'participant',
          priority: recipient.priority || 'normal',
          hasBlocks:
            Array.isArray(recipient.blocks) && recipient.blocks.length > 0,
        });
        const slackUserId = this.extractSlackUserId(recipient.clientId);

        if (!slackUserId) {
          console.error(`Invalid clientId format: ${recipient.clientId}`);
          continue;
        }

        // Open DM channel with user
        console.debug(`opening DM with ${slackUserId}`);
        // Resolve bot credentials for the slack user so we can call the
        // Web API with the correct bot token for that user's workspace.
        const creds = await getCredentialsForSlackUser(slackUserId);
        if (!creds?.botToken) {
          console.error(`No bot credentials found for user ${slackUserId}`);
          continue;
        }

        const web = getWebClientForToken(creds.botToken);
        const dm = await web.conversations.open({ users: slackUserId });

        // Log DM open response shape minimally
        try {
          console.debug('dm.open response:', {
            ok: Boolean(dm.ok),
            channelId: dm.channel?.id || null,
            is_im: dm.channel?.is_im || null,
          });
        } catch (e) {
          console.debug('Failed to log dm.open response', e);
        }

        const channelId = dm.channel?.id;
        if (!channelId) {
          console.error(`Could not open DM with user ${slackUserId}`);
          continue;
        }

        // Send the message. Prefer provided blocks (rich content) if available.
        const hasBlocks =
          Array.isArray(recipient.blocks) && recipient.blocks.length > 0;
        if (hasBlocks) {
          const blocksCount = Array.isArray(recipient.blocks)
            ? recipient.blocks.length
            : 0;
          console.debug('posting message with blocks, payload preview:', {
            channel: channelId,
            textPreview:
              typeof recipient.message === 'string' &&
              recipient.message.length > 120
                ? `${recipient.message.slice(0, 117)}...`
                : recipient.message,
            blocksCount,
          });
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

          console.debug('posting message without blocks, payload preview:', {
            channel: channelId,
            textPreview,
            hasBlocks: recipient.priority === 'high',
          });

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

        console.log(
          `✅ Sent ${notification.type} notification to ${slackUserId} (${recipient.role || 'participant'})`,
        );
      } catch (error) {
        // Provide stack-aware debug for errors
        // Log error object for debugging; stringify may fail on circulars so pass as-is
        console.error(
          `Error sending notification to ${recipient.clientId}:`,
          JSON.stringify(error, null, 2),
        );
      }
    }
  }

  private extractSlackUserId(
    clientId: string | null | undefined,
  ): string | null {
    if (!clientId) return null;
    const trimmed = clientId.trim();
    if (!trimmed) return null;

    if (trimmed.includes(':')) {
      const [, id] = trimmed.split(':', 2);
      return id && id.trim().length > 0 ? id.trim() : null;
    }

    // Accept raw Slack IDs (e.g., U123456) for backward compatibility
    return trimmed;
  }
}
