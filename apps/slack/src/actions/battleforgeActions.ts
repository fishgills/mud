import type { App, BlockAction, RespondFn } from '@slack/bolt';
import { getPrismaClient } from '@mud/database';
import { getActionContext } from './helpers';

export const BATTLEFORGE_ACTIONS = {
  JOIN: 'battleforge:join',
  DISMISS: 'battleforge:dismiss',
} as const;

export const registerBattleforgeActions = (app: App) => {
  const prisma = getPrismaClient();

  app.action<BlockAction>(
    BATTLEFORGE_ACTIONS.JOIN,
    async ({ ack, body, client, context, respond, logger }) => {
      await ack();

      const { userId, teamId } = getActionContext(body, context);
      if (!userId || !teamId) {
        logger?.warn?.(
          '[BATTLEFORGE-ACTIONS] Missing userId or teamId for join',
        );
        return;
      }

      try {
        const workspace = await prisma.workspace.findUnique({
          where: { workspaceId: teamId },
          select: { battleforgeChannelId: true },
        });

        if (!workspace?.battleforgeChannelId) {
          logger?.warn?.(
            '[BATTLEFORGE-ACTIONS] No battleforge channel configured',
          );
          return;
        }

        // Invite the user to the channel
        try {
          await client.conversations.invite({
            channel: workspace.battleforgeChannelId,
            users: userId,
          });
        } catch (inviteErr) {
          // Bug 3 fix: treat already_in_channel as success — user is already there
          const platformErr = inviteErr as { data?: { error?: string } };
          if (platformErr.data?.error !== 'already_in_channel') {
            logger?.warn?.(
              '[BATTLEFORGE-ACTIONS] Join action failed',
              inviteErr,
            );
            return;
          }
        }

        // member_joined_channel event is idempotent, but we update proactively
        await prisma.slackUser.updateMany({
          where: { teamId, userId },
          data: { inBattleforgeChannel: true },
        });

        // Update the ephemeral with confirmation
        await (respond as RespondFn)({
          replace_original: true,
          text: "You've joined #battleforge! Game events will now show up there.",
        });
      } catch (error) {
        logger?.warn?.('[BATTLEFORGE-ACTIONS] Join action failed', error);
      }
    },
  );

  app.action<BlockAction>(
    BATTLEFORGE_ACTIONS.DISMISS,
    async ({ ack, body, context, respond, logger }) => {
      await ack();

      const { userId, teamId } = getActionContext(body, context);
      if (!userId || !teamId) {
        logger?.warn?.(
          '[BATTLEFORGE-ACTIONS] Missing userId or teamId for dismiss',
        );
        return;
      }

      try {
        await prisma.slackUser.updateMany({
          where: { teamId, userId },
          data: { battleforgePromptDeclined: true },
        });

        // Update the ephemeral with confirmation
        await (respond as RespondFn)({
          replace_original: true,
          text: 'Got it — no problem! You can always join #battleforge later.',
        });
      } catch (error) {
        logger?.warn?.('[BATTLEFORGE-ACTIONS] Dismiss action failed', error);
      }
    },
  );
};
