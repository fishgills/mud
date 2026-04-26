import type { WebClient } from '@slack/web-api';
import { getPrismaClient } from '@mud/database';
import { BATTLEFORGE_ACTIONS } from '../actions/battleforgeActions';

const NUDGE_COOLDOWN_DAYS = 7;

/**
 * Sends a one-time ephemeral "Join #battleforge / No thanks" prompt to a user
 * who is not in the battleforge channel and has not permanently declined.
 *
 * Conditions checked:
 *  - inBattleforgeChannel === false
 *  - battleforgePromptDeclined === false
 *  - lastBattleforgePromptAt is null OR > 7 days ago
 */
export async function maybeShowBattleforgePrompt(
  client: WebClient,
  teamId: string,
  userId: string,
): Promise<void> {
  const prisma = getPrismaClient();

  const slackUser = await prisma.slackUser.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: {
      inBattleforgeChannel: true,
      battleforgePromptDeclined: true,
      lastBattleforgePromptAt: true,
    },
  });

  if (!slackUser) return;
  if (slackUser.inBattleforgeChannel) return;
  if (slackUser.battleforgePromptDeclined) return;

  if (slackUser.lastBattleforgePromptAt) {
    const daysSince =
      (Date.now() - slackUser.lastBattleforgePromptAt.getTime()) /
      (1000 * 60 * 60 * 24);
    if (daysSince < NUDGE_COOLDOWN_DAYS) return;
  }

  // Bug 2 fix: check workspace has a battleforgeChannelId configured
  const workspace = await prisma.workspace.findUnique({
    where: { workspaceId: teamId },
    select: { battleforgeChannelId: true },
  });
  if (!workspace?.battleforgeChannelId) return;

  // Bug 1 fix: call postEphemeral first; only bump lastBattleforgePromptAt on success
  try {
    const dm = await client.conversations.open({ users: userId });
    const channelId = dm.channel?.id;
    if (!channelId) return;

    await client.chat.postMessage({
      channel: channelId,
      text: 'Want to see game events in #battleforge?',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '*Want game events in #battleforge?*\nJoin the channel to see level-ups, completed raids, achievements, and shop refreshes — all in one place.',
          },
        },
        {
          type: 'actions',
          elements: [
            {
              type: 'button',
              text: {
                type: 'plain_text',
                text: 'Join #battleforge',
                emoji: true,
              },
              action_id: BATTLEFORGE_ACTIONS.JOIN,
              style: 'primary',
            },
            {
              type: 'button',
              text: { type: 'plain_text', text: 'No thanks', emoji: true },
              action_id: BATTLEFORGE_ACTIONS.DISMISS,
            },
          ],
        },
      ],
    });

    // Only update timestamp after successful delivery
    await prisma.slackUser.updateMany({
      where: { teamId, userId },
      data: { lastBattleforgePromptAt: new Date() },
    });
  } catch {
    // Non-fatal — nudge failure should never interrupt the user's command
  }
}
