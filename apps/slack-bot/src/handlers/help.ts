import type { KnownBlock } from '@slack/types';
import { HandlerContext } from './types';
import { COMMANDS, HELP_ACTIONS } from '../commands';
import { SafeCommandHandler } from './base';

export const helpHandlerHelp = `Show instructions for using the bot with "help".`;

export const buildHelpBlocks = (): KnownBlock[] => [
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
        text: `*Explore & Fight*\n• \`${COMMANDS.NORTH}\`/\`${COMMANDS.SOUTH}\`/\`${COMMANDS.EAST}\`/\`${COMMANDS.WEST}\`\n• \`${COMMANDS.LOOK}\`\n• \`${COMMANDS.SNIFF}\`\n• \`${COMMANDS.ATTACK}\`\n• \`${COMMANDS.STATS}\``,
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
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '*Game Systems*\n• Earn XP from monsters, quests, and discoveries.\n• Combat is turn-based; agility sets turn order and positioning matters.\n• Unlock abilities as you level and spend points in `stats`.',
    },
  },
  {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Leveling guide', emoji: true },
        action_id: HELP_ACTIONS.LEVELING,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Combat primer', emoji: true },
        action_id: HELP_ACTIONS.COMBAT,
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Abilities overview', emoji: true },
        action_id: HELP_ACTIONS.ABILITIES,
      },
    ],
  },
  {
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: 'Tap a topic for deep dives, or type `help` anytime.',
      },
    ],
  },
];

export class HelpHandler extends SafeCommandHandler {
  constructor() {
    super(COMMANDS.HELP, 'Failed to show help');
  }

  protected async perform({ say }: HandlerContext): Promise<void> {
    await say({
      text: 'MUD Bot Commands',
      blocks: buildHelpBlocks(),
    });
  }
}

export const helpHandler = new HelpHandler();
