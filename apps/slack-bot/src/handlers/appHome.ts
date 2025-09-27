import { App, KnownBlock } from '@slack/bolt';
import { COMMANDS } from '../commands';
import { buildHelpBlocks } from './help';

export const buildAppHomeBlocks = (): KnownBlock[] => {
  const helpBlocks = buildHelpBlocks();
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: '🌟 Welcome to the MUD Adventure!', emoji: true },
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
        text: '*🏆 Workspace Leaderboard*\n_Coming soon: see which adventurers are leading the charge in your workspace._',
      },
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
    try {
      await client.views.publish({
        user_id: event.user,
        view: {
          type: 'home',
          callback_id: 'home_view',
          blocks: buildAppHomeBlocks(),
        },
      });
    } catch (error) {
      logger.error('Failed to publish App Home', error);
    }
  });
};
