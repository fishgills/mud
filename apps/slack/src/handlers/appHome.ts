import { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import {
  HELP_ACTIONS,
  HOME_ACTIONS,
  STAT_ACTIONS,
  FEEDBACK_ACTIONS,
} from '../commands';
import { getActiveRun, getLeaderboard, getPlayer } from '../dm-client';
import { formatLeaderboardLines } from './leaderboard';

const buildLeaderboardBlocks = async (
  teamId?: string,
): Promise<KnownBlock[]> => {
  try {
    const workspaceResult = await getLeaderboard({ limit: 3, teamId });
    const workspacePlayers = workspaceResult.data || [];

    const globalResult = await getLeaderboard({ limit: 3 });
    const globalPlayers = globalResult.data || [];

    const workspaceLines = formatLeaderboardLines(workspacePlayers, {
      emptyLabel: 'No heroes yet',
      style: 'medal',
    });

    const globalLines = formatLeaderboardLines(globalPlayers, {
      emptyLabel: 'No legends yet',
      style: 'medal',
    });

    return [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Leaderboards',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*This workspace*\n${workspaceLines}`,
          },
          {
            type: 'mrkdwn',
            text: `*Across all workspaces*\n${globalLines}`,
          },
        ],
      },
    ];
  } catch {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*Leaderboards*\n_Unable to load leaderboards_',
        },
      },
    ];
  }
};

export const buildAppHomeBlocks = async (
  teamId?: string,
  userId?: string,
): Promise<KnownBlock[]> => {
  const feedbackActionsBlock: KnownBlock = {
    type: 'actions',
    elements: [
      {
        type: 'button' as const,
        text: {
          type: 'plain_text' as const,
          text: '📝 Give Feedback',
          emoji: true,
        },
        action_id: FEEDBACK_ACTIONS.OPEN_MODAL,
      },
    ],
  };

  let needsCharacter = false;
  let player: Awaited<ReturnType<typeof getPlayer>>['data'] | undefined;
  let activeRun: Awaited<ReturnType<typeof getActiveRun>>['data'] | undefined;

  if (teamId && userId) {
    try {
      const playerResult = await getPlayer({ teamId, userId });
      if (playerResult.success && playerResult.data) {
        player = playerResult.data;
        try {
          const runResult = await getActiveRun({ teamId, userId });
          if (runResult.success && runResult.data) {
            activeRun = runResult.data;
          }
        } catch {
          activeRun = undefined;
        }
      } else {
        needsCharacter =
          (playerResult.message ?? '')
            .toLowerCase()
            .includes('player not found') ?? false;
      }
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
          text: 'Gather your party, roll your fate, and dive into a living dungeon.',
        },
      },
      {
        type: 'actions' as const,
        elements: [
          {
            type: 'button' as const,
            text: {
              type: 'plain_text' as const,
              text: 'Start Your Adventure',
            },
            style: 'primary' as const,
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
            'Fight monsters',
            'Earn XP and climb the leaderboard',
            'Gear up in the shop',
          ].join('\n'),
        },
      },
      feedbackActionsBlock,
    ];
  }

  if (!player) {
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
          text: 'The tavern ledger is smudged. Tap below to continue.',
        },
      },
      {
        type: 'actions' as const,
        elements: [
          {
            type: 'button' as const,
            text: { type: 'plain_text' as const, text: 'Resume Adventure' },
            style: 'primary' as const,
            action_id: HOME_ACTIONS.RESUME,
          },
        ],
      },
      feedbackActionsBlock,
    ];
  }

  const isPowerUser = Boolean(player.hasMoved && player.hasBattled);
  const isRunLeader =
    Boolean(activeRun && player?.id) && activeRun?.leaderPlayerId === player.id;
  const leaderboardBlocks = isPowerUser
    ? await buildLeaderboardBlocks(teamId)
    : [];

  const primaryHomeAction = isRunLeader
    ? {
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: 'Continue Raid' },
        style: 'primary' as const,
        action_id: HOME_ACTIONS.CONTINUE_RUN,
      }
    : {
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: 'Resume Adventure' },
        style: 'primary' as const,
        action_id: HOME_ACTIONS.RESUME,
      };

  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Adventure Status',
        emoji: true,
      },
    },
    {
      type: 'actions' as const,
      elements: [primaryHomeAction],
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Character*\n${player.name ?? 'Unknown'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Level*\n${player.level ?? '-'}`,
        },
        {
          type: 'mrkdwn',
          text: `*HP*\n${player.hp ?? '-'}/${player.maxHp ?? '-'}`,
        },
        {
          type: 'mrkdwn',
          text: `*XP to Next Level*\n${player.xpToNextLevel ?? '-'}`,
        },
      ],
    },
  ];

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'header',
    text: { type: 'plain_text', text: 'Quick Actions', emoji: true },
  });
  blocks.push({
    type: 'actions' as const,
    elements: [
      {
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: 'Inventory' },
        action_id: HELP_ACTIONS.INVENTORY,
      },
      {
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: 'Web Store' },
        url: 'https://battleforge.app/',
      },
      {
        type: 'button' as const,
        text: { type: 'plain_text' as const, text: 'Stats' },
        action_id: HELP_ACTIONS.STATS,
      },
    ],
  });
  blocks.push({ type: 'divider' });
  blocks.push(feedbackActionsBlock);

  if (isPowerUser) {
    blocks.push({ type: 'divider' }, ...leaderboardBlocks);
    blocks.push({
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'View full leaderboard' },
          action_id: HOME_ACTIONS.VIEW_LEADERBOARD,
        },
      ],
    });

    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: 'Character Management', emoji: true },
    });
    blocks.push({
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'View Stats' },
          action_id: HOME_ACTIONS.VIEW_STATS,
        },
        ...(player.skillPoints && player.skillPoints > 0
          ? [
              {
                type: 'button' as const,
                text: { type: 'plain_text' as const, text: 'Level Up' },
                style: 'primary' as const,
                action_id: STAT_ACTIONS.OPEN_LEVEL_UP,
              },
            ]
          : []),
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'Delete Character' },
          style: 'danger' as const,
          action_id: HOME_ACTIONS.DELETE_CHARACTER,
        },
      ],
    });

    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'header',
      text: { type: 'plain_text', text: 'Help', emoji: true },
    });
    blocks.push({
      type: 'actions' as const,
      elements: [
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'How to Play' },
          action_id: HELP_ACTIONS.HOW_TO_PLAY,
        },
        {
          type: 'button' as const,
          text: { type: 'plain_text' as const, text: 'Command Reference' },
          action_id: HELP_ACTIONS.COMMAND_REFERENCE,
        },
      ],
    });
  }

  return blocks;
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
