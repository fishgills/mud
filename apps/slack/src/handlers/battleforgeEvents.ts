import type { App } from '@slack/bolt';
import { getPrismaClient } from '@mud/database';

export const registerBattleforgeEvents = (app: App) => {
  const prisma = getPrismaClient();

  app.event('member_joined_channel', async ({ event }) => {
    const teamId =
      typeof (event as { team?: string }).team === 'string'
        ? (event as { team: string }).team
        : undefined;
    if (!teamId) return;

    const workspace = await prisma.workspace.findUnique({
      where: { workspaceId: teamId },
      select: { battleforgeChannelId: true },
    });

    if (!workspace?.battleforgeChannelId) return;
    if (workspace.battleforgeChannelId !== event.channel) return;

    await prisma.slackUser.updateMany({
      where: { teamId, userId: event.user },
      data: { inBattleforgeChannel: true },
    });
  });

  app.event('member_left_channel', async ({ event }) => {
    const teamId =
      typeof (event as { team?: string }).team === 'string'
        ? (event as { team: string }).team
        : undefined;
    if (!teamId) return;

    const workspace = await prisma.workspace.findUnique({
      where: { workspaceId: teamId },
      select: { battleforgeChannelId: true },
    });

    if (!workspace?.battleforgeChannelId) return;
    if (workspace.battleforgeChannelId !== event.channel) return;

    await prisma.slackUser.updateMany({
      where: { teamId, userId: event.user },
      data: { inBattleforgeChannel: false },
    });
  });
};
