import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock, ModalView } from '@slack/types';
import { COMMANDS, HOME_ACTIONS } from '../commands';
import type { PlayerRecord } from '../dm-client';
import { dmClient, getLeaderboard } from '../dm-client';
import { dispatchCommandViaDM } from './commandDispatch';
import { getActionContext, postToUser } from './helpers';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import { formatLeaderboardLines } from '../handlers/leaderboard';
import { buildCharacterSheetModal } from '../handlers/commands/stats/modal';

const LEADERBOARD_VIEW_ID = 'leaderboard_view';

const buildLeaderboardView = (params: {
  workspacePlayers: PlayerRecord[];
  globalPlayers: PlayerRecord[];
}): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Leaderboards', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Behold the greatest heroes in this realm and beyond.',
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*This workspace*\\n${formatLeaderboardLines(
            params.workspacePlayers,
            { emptyLabel: 'No heroes yet', style: 'rank' },
          )}`,
        },
        {
          type: 'mrkdwn',
          text: `*Across all workspaces*\\n${formatLeaderboardLines(
            params.globalPlayers,
            { emptyLabel: 'No legends recorded yet', style: 'rank' },
          )}`,
        },
      ],
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: 'Tip: Keep exploring and battling to climb the ranks.',
        },
      ],
    },
  ];

  return {
    type: 'modal',
    callback_id: LEADERBOARD_VIEW_ID,
    title: { type: 'plain_text', text: 'Leaderboards' },
    close: { type: 'plain_text', text: 'Close' },
    blocks,
  };
};

export const registerHomeActions = (app: App) => {
  app.action<BlockAction>(
    HOME_ACTIONS.RESUME,
    async ({ ack, body, client, context }) => {
      await ack();
      const { userId, teamId } = getActionContext(body, context);
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.RUN, teamId);
    },
  );

  app.action<BlockAction>(
    HOME_ACTIONS.CONTINUE_RUN,
    async ({ ack, body, client, context }) => {
      await ack();
      const { userId, teamId } = getActionContext(body, context);
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.CONTINUE, teamId);
    },
  );

  app.action<BlockAction>(
    HOME_ACTIONS.VIEW_STATS,
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
          'Unable to load your stats right now',
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
    HOME_ACTIONS.VIEW_LEADERBOARD,
    async ({ ack, body, client, context, respond }) => {
      await ack();
      const { userId, teamId, triggerId } = getActionContext(body, context);
      if (!userId || !teamId || !triggerId) return;

      try {
        const [workspaceResult, globalResult] = await Promise.all([
          getLeaderboard({ limit: 10, teamId }),
          getLeaderboard({ limit: 10 }),
        ]);

        await client.views.open({
          trigger_id: triggerId,
          view: buildLeaderboardView({
            workspacePlayers: workspaceResult.success
              ? (workspaceResult.data ?? [])
              : [],
            globalPlayers: globalResult.success
              ? (globalResult.data ?? [])
              : [],
          }),
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to load the leaderboards right now.',
        );
        if (respond) {
          await respond({
            text: message,
            response_type: 'ephemeral',
            replace_original: false,
          });
          return;
        }
        await postToUser({ client, userId, text: message });
      }
    },
  );
};
