import { EMOJI_CREATE, EMOJI_REROLL, EMOJI_COMPLETE } from './handlers/emojis';
import { App, LogLevel } from '@slack/bolt';
import { env } from './env';

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.INFO,
});

import './handlers/move';
import './handlers/attack';
import './handlers/create';
import './handlers/reroll';
import './handlers/complete';
import { getAllHandlers } from './handlers/handlerRegistry';

app.event('app_mention', async ({ event, say }) => {
  await say(
    `Hello <@${event.user}>! DM me:
${EMOJI_CREATE} to create your character
${EMOJI_REROLL} to reroll your stats
${EMOJI_COMPLETE} to complete character creation`,
  );
});

app.message(async ({ message, say }) => {
  // Only handle direct user messages (not message_changed, etc)
  if (
    message.type !== 'message' ||
    ('subtype' in message && message.subtype !== undefined) ||
    ('channel_type' in message ? message.channel_type !== 'im' : true)
  ) {
    return;
  }
  const text =
    'text' in message && typeof message.text === 'string'
      ? message.text.trim()
      : '';
  const userId = 'user' in message ? message.user : undefined;
  if (!text || !userId) return;

  // Dispatch to the first matching emoji handler
  // Wrap say so it matches the expected return type (Promise<void>)
  const sayVoid = async (msg: { text: string }) => {
    await say(msg);
  };

  for (const [emoji, handler] of Object.entries(getAllHandlers())) {
    if (text.includes(emoji)) {
      await handler({ userId, say: sayVoid, text });
      return;
    }
  }

  // Help message for unknown input
  await say(
    `Hi <@${userId}>! Use these commands:
${Object.keys(getAllHandlers())
  .map((e) => `${e}`)
  .join('\n')}`,
  );
});

async function start() {
  await app.start(Number(env.PORT));
  console.log('⚡️ Slack MUD bot is running!');
}

start();
