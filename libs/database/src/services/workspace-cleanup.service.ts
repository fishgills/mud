import { getPrismaClient } from '../lib/database.js';

type WorkspaceCleanupResult = {
  deletedPlayers: number;
  deletedInstallations: number;
};

export async function deleteWorkspaceData(
  teamId: string,
): Promise<WorkspaceCleanupResult> {
  const prisma = getPrismaClient();

  const slackUsers = await prisma.slackUser.findMany({
    where: { teamId },
    select: { playerId: true },
  });
  const playerIds = slackUsers.map((entry) => entry.playerId);

  return prisma.$transaction(async (tx) => {
    const deletedPlayers = playerIds.length
      ? await tx.player.deleteMany({
          where: { id: { in: playerIds } },
        })
      : { count: 0 };

    const deletedInstallations = await tx.slackAppInstallation.deleteMany({
      where: { teamId },
    });

    return {
      deletedPlayers: deletedPlayers.count,
      deletedInstallations: deletedInstallations.count,
    };
  });
}
