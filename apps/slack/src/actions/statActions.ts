import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import type { KnownBlock, ModalView } from '@slack/types';
import { STAT_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';
import { PlayerAttribute } from '../dm-types';
import { buildPlayerStatsMessage } from '../handlers/stats/format';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import { buildAppHomeBlocks } from '../handlers/appHome';

const LEVEL_UP_VIEW_ID = 'level_up_view';

const attributeOptions = [
  { label: 'Strength', value: PlayerAttribute.Strength },
  { label: 'Agility', value: PlayerAttribute.Agility },
  { label: 'Vitality', value: PlayerAttribute.Health },
];

const buildLevelUpView = (params: {
  teamId: string;
  userId: string;
  skillPoints: number;
}): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Fate grants you *${params.skillPoints}* skill point${
          params.skillPoints === 1 ? '' : 's'
        } to spend.`,
      },
    },
    {
      type: 'input',
      block_id: 'attribute_block',
      label: { type: 'plain_text', text: 'Choose your boon' },
      element: {
        type: 'static_select',
        action_id: 'selected_attribute',
        placeholder: {
          type: 'plain_text',
          text: 'Select Strength, Agility, or Vitality',
        },
        options: attributeOptions.map((option) => ({
          text: { type: 'plain_text', text: option.label },
          value: option.value,
        })),
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Each point permanently increases your chosen attribute.',
        },
      ],
    },
  ];

  return {
    type: 'modal',
    callback_id: LEVEL_UP_VIEW_ID,
    private_metadata: JSON.stringify({
      teamId: params.teamId,
      userId: params.userId,
    }),
    title: { type: 'plain_text', text: 'Level Up' },
    submit: { type: 'plain_text', text: 'Claim Power' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks,
  };
};

export const registerStatActions = (app: App) => {
  app.action<BlockAction>(
    STAT_ACTIONS.OPEN_LEVEL_UP,
    async ({ ack, body, client, context, respond }) => {
      await ack();

      const userId = body.user?.id;
      const teamId = body.team?.id ?? (context as { teamId?: string })?.teamId;
      const triggerId = body.trigger_id;
      if (!teamId || !userId || !triggerId) {
        app.logger.warn(
          { actionId: STAT_ACTIONS.OPEN_LEVEL_UP, userId, teamId },
          'Missing teamId, userId, or triggerId in level up action payload',
        );
        return;
      }

      try {
        const result = await dmClient.getPlayer({ teamId, userId });
        const player = result.data;
        if (!result.success || !player) {
          const message =
            result.message ?? 'Unable to load your character right now.';
          if (respond) {
            await respond({
              text: message,
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
          return;
        }

        const skillPoints = player.skillPoints ?? 0;
        if (skillPoints <= 0) {
          if (respond) {
            await respond({
              text: 'No skill points to spend yet. Win more battles!',
              response_type: 'ephemeral',
              replace_original: false,
            });
          }
          return;
        }

        await client.views.open({
          trigger_id: triggerId,
          view: buildLevelUpView({
            teamId,
            userId,
            skillPoints,
          }),
        });
      } catch (err) {
        const errorMessage = getUserFriendlyErrorMessage(
          err,
          'Failed to open the level up view',
        );
        if (respond) {
          await respond({
            text: errorMessage,
            response_type: 'ephemeral',
            replace_original: false,
          });
        }
      }
    },
  );

  app.view<ViewSubmitAction>(
    LEVEL_UP_VIEW_ID,
    async ({ ack, view, client }) => {
      const meta = view.private_metadata
        ? JSON.parse(view.private_metadata)
        : null;
      const teamId = meta?.teamId as string | undefined;
      const userId = meta?.userId as string | undefined;
      const attribute =
        view.state.values?.attribute_block?.selected_attribute?.selected_option
          ?.value;

      if (!attribute) {
        await ack({
          response_action: 'errors',
          errors: {
            attribute_block: 'Select an attribute to increase.',
          },
        });
        return;
      }

      if (!teamId || !userId) {
        await ack();
        return;
      }

      try {
        const result = await dmClient.spendSkillPoint({
          teamId,
          userId,
          attribute,
        });
        if (!result.success || !result.data) {
          await ack({
            response_action: 'errors',
            errors: {
              attribute_block:
                result.message ?? 'Unable to spend a skill point right now.',
            },
          });
          return;
        }

        await ack();

        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          const statsMessage = buildPlayerStatsMessage(result.data, {
            isSelf: true,
          });
          await client.chat.postMessage({
            channel,
            text: statsMessage.text,
            blocks: statsMessage.blocks ?? [],
          });
        }

        if (client.views?.publish) {
          try {
            const blocks = await buildAppHomeBlocks(teamId, userId);
            await client.views.publish({
              user_id: userId,
              view: {
                type: 'home',
                callback_id: 'home_view',
                blocks,
              },
            });
          } catch {
            // Ignore refresh failures.
          }
        }
      } catch (err) {
        await ack({
          response_action: 'errors',
          errors: {
            attribute_block: getUserFriendlyErrorMessage(
              err,
              'Failed to spend a skill point',
            ),
          },
        });
      }
    },
  );
};
