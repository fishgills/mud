import { getPrismaClient } from '@mud/database';
import type { NotificationRecipient } from '@mud/redis-client';

/**
 * Build notification recipients for all workspaces that have a #battleforge channel.
 * Returns `slack-channel` recipients for every workspace with a configured channel
 * that has not been uninstalled.
 */
export async function buildBattleforgeRecipients(
  message: string,
  blocks?: Array<Record<string, unknown>>,
): Promise<NotificationRecipient[]> {
  const prisma = getPrismaClient();
  const workspaces = await prisma.workspace.findMany({
    where: { battleforgeChannelId: { not: null }, uninstalledAt: null },
    select: { workspaceId: true, battleforgeChannelId: true },
  });

  return workspaces.map((w) => ({
    clientType: 'slack-channel' as const,
    teamId: w.workspaceId,
    channelId: w.battleforgeChannelId!,
    message,
    blocks,
    priority: 'low' as const,
  }));
}
