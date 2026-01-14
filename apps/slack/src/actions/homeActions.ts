import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock, ModalView } from '@slack/types';
import { COMMANDS, HOME_ACTIONS } from '../commands';
import { dmClient, getLeaderboard, PlayerRecord } from '../dm-client';
import { dispatchCommandViaDM } from './commandDispatch';
import { buildPlayerStatsMessage } from '../handlers/stats/format';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';

const VIEW_STATS_MODAL_ID = 'view_stats_modal';
const LEADERBOARD_VIEW_ID = 'leaderboard_view';

const buildStatsModal = (player: PlayerRecord): ModalView => {
  const statsMessage = buildPlayerStatsMessage(player, {
    isSelf: true,
    includeSkillPointAction: false,
  });
  return {
    type: 'modal',
    callback_id: VIEW_STATS_MODAL_ID,
    title: { type: 'plain_text', text: 'Hero Stats' },
    close: { type: 'plain_text', text: 'Close' },
    blocks: statsMessage.blocks ?? [],
  };
};

const formatLeaderboardLines = (
  players: PlayerRecord[] | undefined,
  emptyLabel: string,
) => {
  if (!players || players.length === 0) {
    return `_${emptyLabel}_`;
  }
  return players
    .map((player, index) => {
      const rank = index + 1;
      const name = player.name ?? 'Unknown';
      const level = player.level ?? '-';
      return `*${rank}.* ${name} - L${level}`;
    })
    .join('\n');
};

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
            'No heroes yet',
          )}`,
        },
        {
          type: 'mrkdwn',
          text: `*Across all workspaces*\\n${formatLeaderboardLines(
            params.globalPlayers,
            'No legends recorded yet',
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
      const userId = body.user?.id;
      const teamId = body.team?.id ?? (context as { teamId?: string })?.teamId;
      if (!userId) return;
      await dispatchCommandViaDM(client, userId, COMMANDS.ATTACK, teamId);
    },
  );

  app.action<BlockAction>(
    HOME_ACTIONS.VIEW_STATS,
    async ({ ack, body, client, context, respond }) => {
      await ack();
      const userId = body.user?.id;
      const teamId = body.team?.id ?? (context as { teamId?: string })?.teamId;
      const triggerId = body.trigger_id;
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
          view: buildStatsModal(result.data),
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
      const userId = body.user?.id;
      const teamId = body.team?.id ?? (context as { teamId?: string })?.teamId;
      const triggerId = body.trigger_id;
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
        const dm = await client.conversations.open({ users: userId });
        const channel = dm.channel?.id;
        if (channel) {
          await client.chat.postMessage({
            channel,
            text: message,
          });
        }
      }
    },
  );
};
