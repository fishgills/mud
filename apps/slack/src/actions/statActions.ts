import type { App, BlockAction, ViewSubmitAction } from '@slack/bolt';
import { STAT_ACTIONS } from '../commands';
import { dmClient } from '../dm-client';
import { getActionContext } from './helpers';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import { buildAppHomeBlocks } from '../handlers/appHome';
import {
  buildCharacterSheetModal,
  CHARACTER_SHEET_VIEW_ID,
  parseSkillPointAttribute,
  SKILL_POINT_BLOCK_ID,
} from '../handlers/stats/modal';

export const registerStatActions = (app: App) => {
  app.action<BlockAction>(
    STAT_ACTIONS.OPEN_LEVEL_UP,
    async ({ ack, body, client, context, respond }) => {
      await ack();

      const { userId, teamId, triggerId } = getActionContext(body, context);
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

        await client.views.open({
          trigger_id: triggerId,
          view: buildCharacterSheetModal(player, {
            teamId,
            userId,
            isSelf: true,
          }),
        });
      } catch (err) {
        const errorMessage = getUserFriendlyErrorMessage(
          err,
          'Failed to open the character sheet',
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
    CHARACTER_SHEET_VIEW_ID,
    async ({ ack, view, client }) => {
      const meta = view.private_metadata
        ? JSON.parse(view.private_metadata)
        : null;
      const teamId = meta?.teamId as string | undefined;
      const userId = meta?.userId as string | undefined;
      const attribute = parseSkillPointAttribute(
        view.state.values as Record<
          string,
          Record<string, { selected_option?: { value?: string } | null }>
        >,
      );

      if (!attribute) {
        await ack({
          response_action: 'errors',
          errors: {
            [SKILL_POINT_BLOCK_ID]: 'Select an attribute to increase.',
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
              [SKILL_POINT_BLOCK_ID]:
                result.message ?? 'Unable to spend a skill point right now.',
            },
          });
          return;
        }

        await ack({
          response_action: 'update',
          view: buildCharacterSheetModal(result.data, {
            teamId,
            userId,
            isSelf: true,
          }),
        });

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
            [SKILL_POINT_BLOCK_ID]: getUserFriendlyErrorMessage(
              err,
              'Failed to spend a skill point',
            ),
          },
        });
      }
    },
  );
};
