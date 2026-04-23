import type { KnownBlock } from '@slack/types';
import { HandlerContext } from '../types';
import { COMMANDS, HELP_ACTIONS } from '../../commands';
import { PlayerCommandHandler } from '../base';

export const helpHandlerHelp = `Show instructions for using the bot with "help".`;

export const buildHelpBlocks = (hasPlayer = false): KnownBlock[] => [
  {
    type: 'header',
    text: { type: 'plain_text', text: '🗡️ MUD Adventurer Guide', emoji: true },
  },
  {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `🚀 *Quick Start*\n\`new YourName\` → \`complete\` → \`${COMMANDS.RUN}\``,
    },
  },
  {
    type: 'actions',
    elements: [
      ...(!hasPlayer
        ? [
            {
              type: 'button' as const,
              text: { type: 'plain_text' as const, text: 'Create', emoji: true },
              style: 'primary' as const,
              action_id: HELP_ACTIONS.CREATE,
            },
          ]
        : []),
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Stats', emoji: true },
        action_id: HELP_ACTIONS.STATS,
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
        text: `*Combat & Raids*\n• \`${COMMANDS.RUN}\` - Start a solo raid\n• \`${COMMANDS.RUN} guild\` - Start a guild raid\n• \`${COMMANDS.CONTINUE}\` - Continue your active raid\n• \`${COMMANDS.ATTACK} @name\` - Duel another player\n• Combat results arrive via DM`,
      },
    ],
  },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Equipment*\n• \`${COMMANDS.CATALOG}\` - View the rotating shop\n• Use the store buttons to buy gear\n• \`${COMMANDS.SELL} <itemId>\` - Sell gear from inventory`,
      },
      {
        type: 'mrkdwn',
        text: `*Inventory*\n• \`${COMMANDS.INVENTORY}\` - View inventory\n• \`${COMMANDS.EQUIP} <itemId> <slot>\` - Equip gear`,
      },
    ],
  },
  {
    type: 'section',
    fields: [
      {
        type: 'mrkdwn',
        text: `*Guilds*\n• \`${COMMANDS.GUILD} info\` - View your guild\n• \`${COMMANDS.GUILD} create <name>\` - Form a guild\n• \`${COMMANDS.GUILD} invite @player\` - Invite a guildmate\n• \`${COMMANDS.GUILD} invites\` - View pending invites\n• \`${COMMANDS.GUILD} join [name]\` - Accept an invite\n• \`${COMMANDS.GUILD} leave\` - Leave (disbands if you are the last member)`,
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
      text: '*Game Systems*\n• Raids are multi-round dives; choose *Continue* to push or *Finish* to cash out.\n• If a raid fails, you earn no XP or gold.\n• Combat is turn-based; agility sets turn order, and raids prompt your next action each round.',
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

export class HelpHandler extends PlayerCommandHandler {
  constructor() {
    super(COMMANDS.HELP, 'Failed to show help', {
      loadPlayer: true,
      requirePlayer: false,
    });
  }

  protected async perform({ say }: HandlerContext): Promise<void> {
    await say({
      text: 'MUD Adventurer Guide',
      blocks: buildHelpBlocks(!!this.player),
    });
  }
}

export const helpHandler = new HelpHandler();
