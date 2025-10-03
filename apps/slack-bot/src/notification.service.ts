/**
 * Notification Service - Subscribes to Redis events and sends Slack notifications
 *
 * This service receives combat notifications, player events, and other game events
 * from the DM service via Redis Pub/Sub and delivers them to Slack users.
 */

import { App } from '@slack/bolt';
import { RedisEventBridge, NotificationMessage } from '@mud/redis-client';
import { env } from './env';

export class NotificationService {
  private bridge: RedisEventBridge;
  private app: App;

  constructor(app: App) {
    this.app = app;
    this.bridge = new RedisEventBridge({
      redisUrl: env.REDIS_URL,
      channelPrefix: 'game',
      enableLogging: process.env.NODE_ENV === 'development',
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
    console.log(
      `📨 Received ${notification.type} notification for ${notification.recipients.length} recipients`,
    );

    // Send message to each recipient
    for (const recipient of notification.recipients) {
      try {
        // Extract Slack user ID from clientId format "slack:U123456"
        const slackUserId = recipient.clientId.split(':')[1];

        if (!slackUserId) {
          console.error(`Invalid clientId format: ${recipient.clientId}`);
          continue;
        }

        // Open DM channel with user
        const dm = await this.app.client.conversations.open({
          users: slackUserId,
        });

        const channelId = dm.channel?.id;
        if (!channelId) {
          console.error(`Could not open DM with user ${slackUserId}`);
          continue;
        }

        // Send the message
        await this.app.client.chat.postMessage({
          channel: channelId,
          text: recipient.message,
          // Add priority indicator for high-priority messages
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

        console.log(
          `✅ Sent ${notification.type} notification to ${slackUserId} (${recipient.role || 'participant'})`,
        );
      } catch (error) {
        console.error(
          `Error sending notification to ${recipient.clientId}:`,
          error,
        );
      }
    }
  }
}
