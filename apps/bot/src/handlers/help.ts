import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';

export const helpHandlerHelp = `Show instructions for using the bot with "help".`;

export const helpHandler = async ({ say }: HandlerContext) => {
  await say({
    text: 'MUD Bot Commands',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🎮 MUD Bot Commands', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🚀 *Quick Start*\n`new YourName` → `complete` → start exploring',
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: '*Character Setup*\n• `new Name`\n• `reroll`\n• `complete`\n• `delete`',
          },
          {
            type: 'mrkdwn',
            text: '*Explore & Fight*\n• `north`/`south`/`east`/`west`\n• `look`\n• `attack`\n• `stats`',
          },
        ],
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: '*Other*\n• `map`\n• `help`' },
          {
            type: 'mrkdwn',
            text: '*Tips*\nDM me commands. Case-insensitive. Try `look` to inspect your tile.',
          },
        ],
      },
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: 'Need help? Type `help` anytime.' }],
      },
    ],
  });
};

// Register help handler for text command only
registerHandler('help', helpHandler);
