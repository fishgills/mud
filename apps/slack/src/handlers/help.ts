import type { KnownBlock } from '@slack/types';
import { HandlerContext } from './types';
import { COMMANDS, HELP_ACTIONS } from '../commands';
import { PlayerCommandHandler } from './base';

export const helpHandlerHelp = `Show instructions for using the bot with "help".`;

export const buildHelpBlocks = (): KnownBlock[] => [
  {
    type: 'header',
    text: { type: 'plain_text', text: '🗺️ MUD Adventurer Guide', emoji: true },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '🚀 *Quick Start*\n`new YourName` → `complete` → begin your quest',
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
    ],
  },
  {
    type: 'section',
    fields: [
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
        text: 'Tap a topic for deep dives. You can also type commands directly in DM.',
      },
    ],
  },
];

const buildGuildHelpBlocks = (): KnownBlock[] => [
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: '🏰 *Guild Hall Services*\nYou are inside the Guild. Take advantage of the quick commands below:',
    },
  },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `• \`${COMMANDS.GUILD}\` - Teleport here from anywhere (cooldown applies)\n• \`${COMMANDS.CATALOG}\` - View the rotating shop list\n• Use \`${COMMANDS.CATALOG}\` buttons to buy and \`${COMMANDS.INVENTORY}\` buttons to sell items.`,
      },
      {
        type: 'mrkdwn',
        text: 'The catalog rotates every 5 minutes. Check the messages from the town crier and merchants for new arrivals.',
      },
    ],
  },
  { type: 'divider' },
];

export class HelpHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.HELP, 'Failed to show help', {
      loadPlayer: true,
      requirePlayer: false,
    });
  }

  protected async perform({ say }: HandlerContext): Promise<void> {
    const blocks = this.player?.isInHq
      ? [...buildGuildHelpBlocks(), ...buildHelpBlocks()]
      : buildHelpBlocks();
    await say({
      text: 'MUD Adventurer Guide',
      blocks,
    });
  }
}

export const helpHandler = new HelpHandler();
