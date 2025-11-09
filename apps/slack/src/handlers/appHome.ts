import { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { COMMANDS } from '../commands';
import { buildHelpBlocks } from './help';
import { getLeaderboard } from '../dm-client';

const buildLeaderboardBlocks = async (
  teamId?: string,
): Promise<KnownBlock[]> => {
  try {
    // Get workspace leaderboard
    const workspaceResult = await getLeaderboard({ limit: 3, teamId });
    const workspacePlayers = workspaceResult.data || [];

    // Get global leaderboard
    const globalResult = await getLeaderboard({ limit: 3 });
    const globalPlayers = globalResult.data || [];

    const blocks: KnownBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🏆 Leaderboards',
          emoji: true,
        },
      },
    ];

    // Workspace leaderboard
    if (workspacePlayers.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🏅 Top Players in This Workspace*',
        },
      });

      workspacePlayers.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${medal} *${player.name}* - Level ${player.level} (${player.xp} XP)`,
          },
        });
      });
    } else {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🏅 Top Players in This Workspace*\n_No players yet in this workspace_',
        },
      });
    }

    blocks.push({ type: 'divider' });

    // Global leaderboard
    if (globalPlayers.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🌍 Top Players Across All Workspaces*',
        },
      });

      globalPlayers.forEach((player, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉';
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${medal} *${player.name}* - Level ${player.level} (${player.xp} XP)`,
          },
        });
      });
    }

    return blocks;
  } catch (err) {
    console.error('Failed to build leaderboard blocks:', err);
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '🏆 *Leaderboards*\n_Unable to load leaderboards_',
        },
      },
    ];
  }
};

export const buildAppHomeBlocks = async (
  teamId?: string,
): Promise<KnownBlock[]> => {
  const helpBlocks = buildHelpBlocks();
  const leaderboardBlocks = await buildLeaderboardBlocks(teamId);

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '🌟 Welcome to the MUD Adventure!',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Rally your party, explore the world, and team up for dungeon-delving fun.',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Need help? DM me \`${COMMANDS.HELP}\` for all commands.`,
        },
      ],
    },
    { type: 'divider' },
    ...leaderboardBlocks,
    { type: 'divider' },
    ...helpBlocks,
  ];
};

export const registerAppHome = (app: App) => {
  console.log('Registering app home event handler');

  // Handle app home opened event
  app.event('app_home_opened', async ({ event, client, logger, context }) => {
    logger.info('App Home opened');
    try {
      const teamId = context.teamId;
      const blocks = await buildAppHomeBlocks(teamId);
      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          callback_id: 'home_view',
          blocks,
        },
      });
    } catch (error) {
      logger.error('Failed to publish App Home', error);
    }
  });
};
