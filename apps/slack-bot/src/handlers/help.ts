import { HandlerContext } from './types';
import { registerHandler } from './handlerRegistry';
import { COMMANDS, HELP_ACTIONS } from '../commands';

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
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Create', emoji: true },
            style: 'primary',
            action_id: HELP_ACTIONS.CREATE,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Look', emoji: true },
            action_id: HELP_ACTIONS.LOOK,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Stats', emoji: true },
            action_id: HELP_ACTIONS.STATS,
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Map', emoji: true },
            action_id: HELP_ACTIONS.MAP,
          },
        ],
      },
      { type: 'divider' },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Character Setup*\n• \`${COMMANDS.NEW} Name\`\n• \`${COMMANDS.REROLL}\`\n• \`${COMMANDS.COMPLETE}\`\n• \`${COMMANDS.DELETE}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Explore & Fight*\n• \`${COMMANDS.NORTH}\`/\`${COMMANDS.SOUTH}\`/\`${COMMANDS.EAST}\`/\`${COMMANDS.WEST}\`\n• \`${COMMANDS.LOOK}\`\n• \`${COMMANDS.ATTACK}\`\n• \`${COMMANDS.STATS}\``,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Other*\n• \`${COMMANDS.MAP}\`\n• \`${COMMANDS.HELP}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Tips*\nDM me commands. Case-insensitive. Try \`${COMMANDS.LOOK}\` to inspect your tile.`,
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
registerHandler(COMMANDS.HELP, helpHandler);
