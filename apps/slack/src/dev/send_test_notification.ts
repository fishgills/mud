/**
 * send_test_notification.ts
 *
 * Small helper to publish a NotificationMessage to Redis so the Slack
 * NotificationService (if running) will pick it up and deliver to a user.
 *
 * Usage:
 *   # from repo root
 *   cd apps/slack
 *   npx ts-node src/dev/send_test_notification.ts U12345678 "Optional message"
 *
 * Or set SLACK_TEST_ID and SLACK_TEST_MESSAGE environment variables.
 */

import { RedisEventBridge } from '@mud/redis-client';

// Don't import the full `env` validation here because that forces all Slack
// env vars to exist. Read REDIS_URL directly from process.env with a safe
// default so this helper can be used in dev without running the whole app.
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

async function main() {
  const slackIdArg = process.argv[2] || process.env.SLACK_TEST_ID;
  const messageArg =
    process.argv[3] ||
    process.env.SLACK_TEST_MESSAGE ||
    'Test notification from local script';

  if (!slackIdArg) {
    console.error(
      'Usage: npx ts-node src/dev/send_test_notification.ts <SLACK_USER_ID> [message]',
    );
    console.error('Or set SLACK_TEST_ID and SLACK_TEST_MESSAGE env vars.');
    process.exit(1);
  }

  const slackId = slackIdArg.replace(/^slack:/, '');

  const bridge = new RedisEventBridge({
    redisUrl,
    channelPrefix: 'game',
    enableLogging: true,
  });

  try {
    await bridge.connect();

    // Build a minimal CombatEndEvent-shaped object as the associated event
    const event = {
      eventType: 'player:levelup',
      player: {
        id: 'player1',
        slackId: slackIdArg,
      },
      newLevel: 2,
      skillPointsGained: 5,
      timestamp: Date.now(),
    } as any;

    await bridge.publishNotification({
      type: 'player',
      event: event,
      recipients: [
        {
          clientType: 'slack',
          clientId: `slack:${slackId}`,
          message: String(messageArg),
          role: 'observer',
          priority: 'high',
        },
      ],
    });

    console.log(`Published test notification for slack:${slackId}`);
  } catch (err) {
    console.error('Failed to publish test notification:', err);
    process.exitCode = 2;
  } finally {
    await bridge.disconnect().catch(() => undefined);
  }
}

void main();
