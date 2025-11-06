import { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import type { WebClient } from '@slack/web-api';
import { COMMANDS } from '../commands';
import { buildHelpBlocks } from './help';
import {
  getPlayer,
  rerollPlayerStats,
  completePlayer,
  deletePlayer,
} from '../dm-client';
import { toClientId } from '../utils/clientId';

interface PlayerStatus {
  hasCharacter: boolean;
  isActive: boolean; // Character creation is complete
  playerName?: string;
}

const getPlayerStatus = async (
  userId: string,
  teamId?: string,
): Promise<PlayerStatus> => {
  try {
    const result = await getPlayer({
      slackId: toClientId(userId, teamId || ''),
    });
    if (result.success && result.data) {
      return {
        hasCharacter: true,
        isActive: Boolean(result.data.isAlive),
        playerName: result.data.name,
      };
    }
  } catch (err) {
    console.error('Failed to fetch player status:', err);
  }
  return { hasCharacter: false, isActive: false };
};

const buildActionButtons = (status: PlayerStatus): KnownBlock[] => {
  if (!status.hasCharacter) {
    // No character - show create button
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '*🎮 Get Started*\nCreate your character to begin your adventure!',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '⚔️ Create Character',
              emoji: true,
            },
            style: 'primary',
            action_id: 'app_home_create_character',
          },
        ],
      },
    ];
  }

  if (!status.isActive) {
    // Character exists but not completed - show creation actions
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🎲 Complete Your Character*\nFinish creating *${status.playerName}* to start your adventure!`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🎲 Reroll Stats',
              emoji: true,
            },
            action_id: 'app_home_reroll',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '✅ Complete Character',
              emoji: true,
            },
            style: 'primary',
            action_id: 'app_home_complete',
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🗑️ Delete & Start Over',
              emoji: true,
            },
            style: 'danger',
            action_id: 'app_home_delete',
          },
        ],
      },
    ];
  }

  // Active character - show gameplay actions
  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚔️ ${status.playerName}'s Adventure*\nYour character is ready for action!`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '👀 Look Around',
            emoji: true,
          },
          style: 'primary',
          action_id: 'app_home_look',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📊 View Stats',
            emoji: true,
          },
          action_id: 'app_home_stats',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🗺️ View Map',
            emoji: true,
          },
          action_id: 'app_home_map',
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🎒 View Inventory',
            emoji: true,
          },
          action_id: 'app_home_inventory',
        },
      ],
    },
  ];
};

export const buildAppHomeBlocks = async (
  userId: string,
  teamId?: string,
): Promise<KnownBlock[]> => {
  const status = await getPlayerStatus(userId, teamId);
  const helpBlocks = buildHelpBlocks();
  const actionButtons = buildActionButtons(status);

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
    ...actionButtons,
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
      const teamId =
        typeof context.teamId === 'string' ? context.teamId : undefined;
      const blocks = await buildAppHomeBlocks(event.user, teamId);
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

  // Helper function to refresh app home
  const refreshAppHome = async (
    userId: string,
    teamId: string | undefined,
    client: WebClient,
  ) => {
    const blocks = await buildAppHomeBlocks(userId, teamId);
    await client.views.publish({
      user_id: userId,
      view: {
        type: 'home',
        callback_id: 'home_view',
        blocks,
      },
    });
  };

  // Action: Create character (opens modal)
  app.action('app_home_create_character', async ({ ack, body, client }) => {
    await ack();
    // For now, send a message - in future could open a modal
    await client.chat.postMessage({
      channel: body.user.id,
      text: `To create a character, send me a message: \`${COMMANDS.NEW} YourCharacterName\``,
    });
  });

  // Action: Reroll stats
  app.action('app_home_reroll', async ({ ack, body, client }) => {
    await ack();
    try {
      const teamId = body.team?.id;
      const result = await rerollPlayerStats({
        slackId: toClientId(body.user.id, teamId || ''),
      });
      if (result.success) {
        await refreshAppHome(body.user.id, teamId, client);
        await client.chat.postMessage({
          channel: body.user.id,
          text: '🎲 Your stats have been rerolled! Check the Home tab to see your new stats.',
        });
      } else {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Error: ${result.message}`,
        });
      }
    } catch (err) {
      console.error('Failed to reroll stats:', err);
      await client.chat.postMessage({
        channel: body.user.id,
        text: 'Failed to reroll stats. Please try again.',
      });
    }
  });

  // Action: Complete character
  app.action('app_home_complete', async ({ ack, body, client }) => {
    await ack();
    try {
      const teamId = body.team?.id;
      const result = await completePlayer({
        slackId: toClientId(body.user.id, teamId || ''),
      });
      if (result.success) {
        await refreshAppHome(body.user.id, teamId, client);
        await client.chat.postMessage({
          channel: body.user.id,
          text: '✅ Character creation complete! You can now move and attack.',
        });
      } else {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Error: ${result.message}`,
        });
      }
    } catch (err) {
      console.error('Failed to complete character:', err);
      await client.chat.postMessage({
        channel: body.user.id,
        text: 'Failed to complete character. Please try again.',
      });
    }
  });

  // Action: Delete character
  app.action('app_home_delete', async ({ ack, body, client }) => {
    await ack();
    try {
      const teamId = body.team?.id;
      const result = await deletePlayer({
        slackId: toClientId(body.user.id, teamId || ''),
      });
      if (result.success) {
        await refreshAppHome(body.user.id, teamId, client);
        await client.chat.postMessage({
          channel: body.user.id,
          text: '🗑️ Your character has been deleted. Create a new one to start fresh!',
        });
      } else {
        await client.chat.postMessage({
          channel: body.user.id,
          text: `Error: ${result.message}`,
        });
      }
    } catch (err) {
      console.error('Failed to delete character:', err);
      await client.chat.postMessage({
        channel: body.user.id,
        text: 'Failed to delete character. Please try again.',
      });
    }
  });

  // Action: Look around
  app.action('app_home_look', async ({ ack, body, client }) => {
    await ack();
    await client.chat.postMessage({
      channel: body.user.id,
      text: `To look around, send me: \`${COMMANDS.LOOK}\``,
    });
  });

  // Action: View stats
  app.action('app_home_stats', async ({ ack, body, client }) => {
    await ack();
    await client.chat.postMessage({
      channel: body.user.id,
      text: `To view your stats, send me: \`${COMMANDS.STATS}\``,
    });
  });

  // Action: View map
  app.action('app_home_map', async ({ ack, body, client }) => {
    await ack();
    await client.chat.postMessage({
      channel: body.user.id,
      text: `To view the map, send me: \`${COMMANDS.MAP}\``,
    });
  });

  app.action('app_home_inventory', async ({ ack, body, client }) => {
    await ack();
    await client.chat.postMessage({
      channel: body.user.id,
      text: `To view your inventory, send me: \`${COMMANDS.INVENTORY}\``,
    });
  });
};
