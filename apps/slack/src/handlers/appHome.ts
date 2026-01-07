import { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { COMMANDS, HELP_ACTIONS } from '../commands';
import { buildHelpBlocks } from './help';
import { getLeaderboard, getPlayer } from '../dm-client';
import { getRecentChangelogEntries } from '../services/changelog.service';

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
  } catch {
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

const buildChangelogBlocks = async (): Promise<KnownBlock[]> => {
  try {
    const entries = await getRecentChangelogEntries(10);
    if (entries.length === 0) {
      return [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🆕 Latest Updates',
            emoji: true,
          },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '_No recent Conventional Commits found._',
          },
        },
      ];
    }

    const formatted = entries
      .map((entry) => {
        const scopeText = entry.scope ? ` (${entry.scope})` : '';
        const breakingPrefix = entry.breaking ? '⚠️ ' : '';
        const shortHash = entry.hash ? entry.hash.slice(0, 7) : '';
        return `• ${breakingPrefix}*${entry.type}${scopeText}*: ${entry.description}${
          shortHash ? ` \`${shortHash}\`` : ''
        }`;
      })
      .join('\n');

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🆕 Latest Updates',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: formatted,
        },
      },
    ];
  } catch {
    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🆕 Latest Updates',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '_Unable to load changelog entries._',
        },
      },
    ];
  }
};

export const buildAppHomeBlocks = async (
  teamId?: string,
  userId?: string,
): Promise<KnownBlock[]> => {
  let needsCharacter = false;
  if (teamId && userId) {
    try {
      const playerResult = await getPlayer({ teamId, userId });
      needsCharacter =
        !playerResult.success &&
        (playerResult.message ?? '').toLowerCase().includes('player not found');
    } catch {
      needsCharacter = false;
    }
  }
  if (needsCharacter) {
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
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: ':crossed_swords: Start Your Adventure',
              emoji: true,
            },
            style: 'primary',
            action_id: HELP_ACTIONS.CREATE,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'Takes about 30 seconds. No setup required.',
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: [
            '⚔️ Fight monsters',
            '🗺️ Explore a shared world',
            '🏆 Earn XP and climb the leaderboard',
          ].join('\n'),
        },
      },
    ];
  }
  const helpBlocks = buildHelpBlocks();
  const leaderboardBlocks = await buildLeaderboardBlocks(teamId);
  const changelogBlocks = await buildChangelogBlocks();

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
    ...changelogBlocks,
    { type: 'divider' },
    ...helpBlocks,
  ];
};

export const registerAppHome = (app: App) => {
  app.logger.info('Registering app home event handler');

  // Handle app home opened event
  app.event('app_home_opened', async ({ event, client, logger, context }) => {
    logger.info('App Home opened');
    try {
      const teamId = context.teamId;
      const blocks = await buildAppHomeBlocks(teamId, event.user);
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
