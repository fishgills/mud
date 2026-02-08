import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { COMMANDS, HELP_ACTIONS } from '../commands';
import { dispatchCommandViaDM } from './commandDispatch';
import { dmClient, getPlayerItems } from '../dm-client';
import { buildCharacterSheetModal } from '../handlers/stats/modal';
import { buildInventoryModal } from '../handlers/inventory';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import { getActionContext, postToUser } from './helpers';

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
          text: `*Core loop*\n• Use \`${COMMANDS.RUN}\` to start combat and earn XP and gold.\n• Duel another player with \`${COMMANDS.ATTACK} @name\`.\n• Equip gear from the shop to improve your odds.`,
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
          text: '*Earn XP*\n• Defeat monsters to gain experience.\n• Track your current XP and next level in `stats`.',
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
            text: 'Tip: Partying up shares XP, and better gear makes every fight easier.',
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
          text: '*Turn Order*\n• Battles are turn-based: the highest Agility acts first each round.',
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Actions*\n• Use \`${COMMANDS.ATTACK} @name\` to duel another player.\n• Choose your next move when raid combat prompts appear.\n• Watch the combat log for status effects, cooldowns, and enemy intents.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Need a refresher? Use `stats` to review your build anytime.',
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
          text: '*Using Abilities*\n• Abilities appear as options during combat prompts.\n• Many consume stamina or have cooldowns—plan combos with your party.',
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
  client: App['client'],
  userId: string,
  message: HelpDetailMessage,
) => {
  await postToUser({
    client,
    userId,
    text: message.text,
    blocks: message.blocks,
  });
};

export const registerHelpActions = (app: App) => {
  app.action<BlockAction>(
    HELP_ACTIONS.STATS,
    async ({ ack, body, client, context, respond }) => {
      await ack();
      const { userId, teamId, triggerId } = getActionContext(body, context);
      if (!userId || !teamId || !triggerId) return;
      try {
        const result = await dmClient.getPlayer({ teamId, userId });
        if (!result.success || !result.data) {
          const message =
            result.message ?? 'Unable to load your stats right now.';
          if (respond) {
            await respond({
              text: message,
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
          return;
        }
        await client.views.open({
          trigger_id: triggerId,
          view: buildCharacterSheetModal(result.data, {
            teamId,
            userId,
            isSelf: true,
          }),
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to load your stats right now.',
        );
        if (respond) {
          await respond({
            text: message,
            response_type: 'ephemeral',
            replace_original: false,
          });
        }
      }
    },
  );

  app.action<BlockAction>(
    HELP_ACTIONS.INVENTORY,
    async ({ ack, body, client, context, respond }) => {
      await ack();
      const { userId, teamId, triggerId } = getActionContext(body, context);
      if (!userId || !teamId || !triggerId) return;
      try {
        const result = await getPlayerItems({ teamId, userId });
        if (!result.success || !result.data) {
          const message =
            result.message ?? 'Unable to load your inventory right now.';
          if (respond) {
            await respond({
              text: message,
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
          return;
        }
        await client.views.open({
          trigger_id: triggerId,
          view: buildInventoryModal(result.data),
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to load your inventory right now.',
        );
        if (respond) {
          await respond({
            text: message,
            response_type: 'ephemeral',
            replace_original: false,
          });
        }
      }
    },
  );

  app.action<BlockAction>(
    HELP_ACTIONS.COMMAND_REFERENCE,
    async ({ ack, body, client, context }) => {
      await ack();
      const { userId, teamId } = getActionContext(body, context);
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
