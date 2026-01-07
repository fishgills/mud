import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';
import { COMMANDS, HELP_ACTIONS } from '../commands';
import { dispatchCommandViaDM } from './commandDispatch';

type HelpDetailMessage = {
  text: string;
  blocks: KnownBlock[];
};

const helpDetailMessages: Record<string, HelpDetailMessage> = {
  [HELP_ACTIONS.HOW_TO_PLAY]: {
    text: 'How to Play',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'How to Play', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Start the adventure*\n• Open the Home tab and press *Start Your Adventure*.\n• Name your hero, review your rolls, and press *Start Adventure*.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Core loop*\n• Use `look` to scout the room, then move with `north`, `south`, `east`, `west`.\n• Use `attack` to start combat and earn XP and loot.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Tip: The Home tab is your quest board for quick actions.',
          },
        ],
      },
    ],
  },
  [HELP_ACTIONS.LEVELING]: {
    text: 'Leveling & Progression',
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Leveling & Progression',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Earn XP*\n• Defeat monsters, clear quests, and discover new rooms to gain experience.\n• Track your current XP and next level in `stats`.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Leveling Up*\n• Each level awards attribute points to spend on Strength, Agility, or Vitality from the `stats` menu.\n• Higher levels unlock new gear tiers and ability slots at key milestones.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Tip: Partying up shares XP, and exploring new tiles gives a small bonus once per room.',
          },
        ],
      },
    ],
  },
  [HELP_ACTIONS.COMBAT]: {
    text: 'Combat Primer',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Combat Primer', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Turn Order*\n• Battles are turn-based: the highest Agility acts first each round.\n• Moving before a fight sets your range and who you can reach.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Actions*\n• Use `attack` to strike with your weapon, or trigger abilities that appear in combat prompts.\n• Watch the combat log for status effects, cooldowns, and enemy intents.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Need a refresher? Use `look` mid-fight to review the room and opponents.',
          },
        ],
      },
    ],
  },
  [HELP_ACTIONS.ABILITIES]: {
    text: 'Abilities & Power',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Abilities & Power', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Unlocking Abilities*\n• New abilities unlock automatically at level milestones.\n• Spend ability points from the `stats` view to slot or upgrade them.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Using Abilities*\n• Abilities appear as options during combat alongside `attack`.\n• Many consume stamina or have cooldowns—plan combos with your party.',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Pro tip: Reroll before completing character creation if you want different starting abilities.',
          },
        ],
      },
    ],
  },
  [HELP_ACTIONS.REPORT_ISSUE]: {
    text: 'Report an Issue',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Report an Issue', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Send word from this DM with what happened, what you expected, and any screenshots or timestamps.',
        },
      },
    ],
  },
};

const sendHelpDetailViaDM = async (
  client: WebClient,
  userId: string,
  message: HelpDetailMessage,
) => {
  const dm = await client.conversations.open({ users: userId });
  const channel = dm.channel?.id;
  if (!channel) return;
  await client.chat.postMessage({
    channel,
    text: message.text,
    blocks: message.blocks,
  });
};

export const registerHelpActions = (app: App) => {
  app.action<BlockAction>(
    HELP_ACTIONS.LOOK,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.LOOK, teamId);
    },
  );

  app.action<BlockAction>(
    HELP_ACTIONS.STATS,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.STATS, teamId);
    },
  );

  app.action<BlockAction>(
    HELP_ACTIONS.MAP,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.MAP, teamId);
    },
  );

  app.action<BlockAction>(
    HELP_ACTIONS.INVENTORY,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.INVENTORY, teamId);
    },
  );

  app.action<BlockAction>(
    HELP_ACTIONS.COMMAND_REFERENCE,
    async ({ ack, body, client, context }) => {
      await ack();
      const userId = body.user?.id;
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.HELP, teamId);
    },
  );

  for (const [actionId, message] of Object.entries(helpDetailMessages)) {
    app.action<BlockAction>(actionId, async ({ ack, body, client }) => {
      await ack();
      const userId = body.user?.id;
      if (!userId) return;
      await sendHelpDetailViaDM(client, userId, message);
    });
  }
};
