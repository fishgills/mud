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
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Inventory', emoji: true },
        action_id: HELP_ACTIONS.INVENTORY,
      },
    ],
  },
  { type: 'divider' },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Character Setup*\n• \`${COMMANDS.NEW} Name\` - Create character\n• \`${COMMANDS.REROLL}\` - Reroll stats\n• \`${COMMANDS.COMPLETE}\` - Finish creation\n• \`${COMMANDS.DELETE}\` - Delete character`,
      },
      {
        type: 'mrkdwn',
        text: `*Movement*\n• \`${COMMANDS.NORTH}\`/\`${COMMANDS.UP}\` - Move north\n• \`${COMMANDS.SOUTH}\`/\`${COMMANDS.DOWN}\` - Move south\n• \`${COMMANDS.EAST}\`/\`${COMMANDS.RIGHT}\` - Move east\n• \`${COMMANDS.WEST}\`/\`${COMMANDS.LEFT}\` - Move west`,
      },
    ],
  },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Exploration*\n• \`${COMMANDS.LOOK}\` or \`${COMMANDS.LOOK_SHORT}\` - Look around\n• \`${COMMANDS.SNIFF}\` - Detect nearby monsters\n• \`${COMMANDS.MAP}\` - View world map\n• \`${COMMANDS.INSPECT}\` - Inspect target`,
      },
      {
        type: 'mrkdwn',
        text: `*Combat*\n• \`${COMMANDS.ATTACK}\` - Attack target\n• \`${COMMANDS.ATTACK} @player\` - Attack player\n• \`${COMMANDS.ATTACK} monster\` - Attack monster`,
      },
    ],
  },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Inventory & Items*\n• \`${COMMANDS.INVENTORY}\` - View inventory\n• \`${COMMANDS.PICKUP}\` - Pick up items\n• \`${COMMANDS.EQUIP}\` - Equip item\n• Use the inventory view to drop items`,
      },
      {
        type: 'mrkdwn',
        text: `*Character Info*\n• \`${COMMANDS.STATS}\` - View your stats\n• \`${COMMANDS.HELP}\` - Show this help`,
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
