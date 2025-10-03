import { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { COMMANDS } from '../commands';
import { dmSdk } from '../gql-client';
import type { GetAllPlayersQuery } from '../generated/dm-graphql';
import { buildHelpBlocks } from './help';

type LeaderboardPlayer = GetAllPlayersQuery['getAllPlayers'][number];

const MAX_LEADERBOARD_ENTRIES = 10;

function formatLeaderboardLine(player: LeaderboardPlayer, index: number): string {
  const rank = index + 1;
  const xpText = typeof player.xp === 'number' ? ` · ${player.xp} XP` : '';
  const status = player.isAlive ? '' : ' ☠️';
  return `${rank}. *${player.name}* — Level ${player.level}${xpText}${status}`;
}

function buildLeaderboardText(leaderboard: LeaderboardPlayer[]): string {
  if (leaderboard.length === 0) {
    return '_No adventurers have stepped forward yet. Be the first to create your character!_';
  }

  return leaderboard.map(formatLeaderboardLine).join('\n');
}

export const buildAppHomeBlocks = (options: {
  leaderboard?: LeaderboardPlayer[];
} = {}): KnownBlock[] => {
  const helpBlocks = buildHelpBlocks();
  const leaderboard = options.leaderboard ?? [];
  const leaderboardText = buildLeaderboardText(leaderboard);
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
        text: 'Thanks for installing MUD Bot! Rally your party, explore the world, and team up for dungeon-delving fun.',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Need a refresher later? DM me \`${COMMANDS.HELP}\` for these commands anytime.`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🏆 Workspace Leaderboard*\n${leaderboardText}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Top ${Math.min(leaderboard.length || MAX_LEADERBOARD_ENTRIES, MAX_LEADERBOARD_ENTRIES)} ranked by level, then XP.`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*🌐 Global Friendly Competitions*\n_Coming soon: compare your workspace with others across the realm._',
      },
    },
    { type: 'divider' },
    ...helpBlocks,
  ];
};

export const registerAppHome = (app: App) => {
  app.event('app_home_opened', async ({ event, client, logger }) => {
    let leaderboard: LeaderboardPlayer[] = [];
    try {
      const result = await dmSdk.GetAllPlayers();
      leaderboard = [...result.getAllPlayers]
        .sort((a, b) => {
          if (b.level !== a.level) {
            return b.level - a.level;
          }
          if (b.xp !== a.xp) {
            return b.xp - a.xp;
          }
          return a.name.localeCompare(b.name);
        })
        .slice(0, MAX_LEADERBOARD_ENTRIES);
    } catch (error) {
      logger.error('Failed to load leaderboard', error);
    }

    try {
      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          callback_id: 'home_view',
          blocks: buildAppHomeBlocks({ leaderboard }),
        },
      });
    } catch (error) {
      logger.error('Failed to publish App Home', error);
    }
  });
};
