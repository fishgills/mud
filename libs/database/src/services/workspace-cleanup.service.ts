import { getPrismaClient } from '../lib/database.js';

type WorkspaceCleanupResult = {
  deletedPlayers: number;
  deletedInstallations: number;
};

export async function deleteWorkspaceData(
  teamId: string,
): Promise<WorkspaceCleanupResult> {
  const prisma = getPrismaClient();

  return prisma.$transaction(async (tx) => {
    const slackUsers = await tx.slackUser.findMany({
      where: { teamId },
      select: { playerId: true },
    });
    const playerIds = slackUsers.map((entry) => entry.playerId);

    if (playerIds.length) {
      // Run.leaderPlayerId has onDelete: Restrict, so runs must be deleted before players
      await tx.run.deleteMany({ where: { leaderPlayerId: { in: playerIds } } });
      await tx.player.deleteMany({ where: { id: { in: playerIds } } });
    }

    const deletedInstallations = await tx.slackAppInstallation.deleteMany({
      where: { teamId },
    });

    return {
      deletedPlayers: playerIds.length,
      deletedInstallations: deletedInstallations.count,
    };
  });
}
