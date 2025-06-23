import { App, LogLevel } from '@slack/bolt';
import { env } from './env';
import { dmSdk } from './gql-client';

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  logLevel: LogLevel.INFO,
});

import { EMOJI_CREATE, EMOJI_REROLL, EMOJI_COMPLETE } from './handlers/emojis';
import { createHandler } from './handlers/create';
import { rerollHandler } from './handlers/reroll';
import { completeHandler } from './handlers/complete';
import { HandlerContext } from './handlers/types';
import {
  moveHandler,
  EMOJI_NORTH,
  EMOJI_EAST,
  EMOJI_SOUTH,
  EMOJI_WEST,
} from './handlers/move';
import { attackHandler, EMOJI_ATTACK } from './handlers/attack';

type EmojiHandler = (ctx: HandlerContext) => Promise<void>;

const handlers: Record<string, EmojiHandler> = {
  [EMOJI_CREATE]: createHandler,
  [EMOJI_REROLL]: rerollHandler,
  [EMOJI_COMPLETE]: completeHandler,
  [EMOJI_NORTH]: moveHandler,
  [EMOJI_EAST]: moveHandler,
  [EMOJI_SOUTH]: moveHandler,
  [EMOJI_WEST]: moveHandler,
  [EMOJI_ATTACK]: attackHandler,
};

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
  for (const [emoji, handler] of Object.entries(handlers)) {
    if (text.includes(emoji)) {
      await handler({ userId, say: sayVoid, text });
      return;
    }
  }

  // Help message for unknown input
  await say(
    `Hi <@${userId}>! Use these commands:
${Object.keys(handlers)
  .map((e) => `${e} to ${handlerDescription(e)}`)
  .join('\n')}`,
  );
});

// Helper to describe each emoji command for help text
function handlerDescription(emoji: string): string {
  switch (emoji) {
    case EMOJI_CREATE:
      return 'create your character';
    case EMOJI_REROLL:
      return 'reroll your stats';
    case EMOJI_COMPLETE:
      return 'complete character creation';
    case EMOJI_NORTH:
      return 'move north';
    case EMOJI_EAST:
      return 'move east';
    case EMOJI_SOUTH:
      return 'move south';
    case EMOJI_WEST:
      return 'move west';
    case EMOJI_ATTACK:
      return 'attack a nearby monster';
    default:
      return 'unknown action';
  }
}

async function start() {
  await app.start(Number(env.PORT));
  console.log('⚡️ Slack MUD bot is running!');
}

start();
