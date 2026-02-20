import type { App, BlockAction } from '@slack/bolt';
import type { KnownBlock, ModalView } from '@slack/types';
import { COMMANDS, HOME_ACTIONS } from '../commands';
import type { PlayerRecord } from '../dm-client';
import { dmClient, getAchievementList, getLeaderboard } from '../dm-client';
import { dispatchCommandViaDM } from './commandDispatch';
import { getActionContext, postToUser } from './helpers';
import { getUserFriendlyErrorMessage } from '../handlers/errorUtils';
import { formatLeaderboardLines } from '../handlers/leaderboard';
import { buildCharacterSheetModal } from '../handlers/commands/stats/modal';

const LEADERBOARD_VIEW_ID = 'leaderboard_view';
const ACHIEVEMENTS_VIEW_ID = 'achievements_view';

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
          text: `*This workspace*\n${formatLeaderboardLines(
            params.workspacePlayers,
            { emptyLabel: 'No heroes yet', style: 'rank' },
          )}`,
        },
        {
          type: 'mrkdwn',
          text: `*Across all workspaces*\n${formatLeaderboardLines(
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

const buildAchievementsView = (params: {
  summary: { unlockedCount: number; totalCount: number };
  categories: Array<{
    category: string;
    achievements: Array<{
      id: string;
      name: string;
      description: string;
      isUnlocked: boolean;
      unlockedAt: string | null;
    }>;
  }>;
}): ModalView => {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Achievements', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Unlocked *${params.summary.unlockedCount}/${params.summary.totalCount}* achievements.`,
      },
    },
  ];

  for (const category of params.categories) {
    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: {
        type: 'plain_text',
        text: category.category,
        emoji: true,
      },
    });

    for (const achievement of category.achievements) {
      const status = achievement.isUnlocked ? '✅' : '⬜';
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `${status} ${achievement.name}\n${achievement.description}`,
        },
      });
    }
  }

  return {
    type: 'modal',
    callback_id: ACHIEVEMENTS_VIEW_ID,
    title: { type: 'plain_text', text: 'Achievements' },
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

  app.action<BlockAction>(
    HOME_ACTIONS.VIEW_ACHIEVEMENTS,
    async ({ ack, body, client, context, respond }) => {
      await ack();
      const { userId, teamId, triggerId } = getActionContext(body, context);
      if (!userId || !teamId || !triggerId) return;

      try {
        const result = await getAchievementList({ teamId, userId });
        if (!result.success || !result.data) {
          const message =
            result.message ?? 'Unable to load achievements right now.';
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
          view: buildAchievementsView({
            summary: result.data.summary,
            categories: result.data.categories.map((category) => ({
              category: category.category,
              achievements: category.achievements.map((achievement) => ({
                id: achievement.id,
                name: achievement.name,
                description: achievement.description,
                isUnlocked: achievement.isUnlocked,
                unlockedAt: achievement.unlockedAt,
              })),
            })),
          }),
        });
      } catch (err) {
        const message = getUserFriendlyErrorMessage(
          err,
          'Unable to load achievements right now.',
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
};
