import type { App } from '@slack/bolt';
import { deleteWorkspaceData } from '@mud/database';

type UninstallContext = {
  teamId?: string;
};

export function registerUninstallHandler(app: App) {
  app.event('app_uninstalled', async ({ context, logger }) => {
    const teamId = (context as UninstallContext)?.teamId;
    if (!teamId) {
      logger.warn('app_uninstalled received without teamId; skipping cleanup');
      return;
    }

    try {
      const result = await deleteWorkspaceData(teamId);
      logger.info(
        {
          teamId,
          deletedPlayers: result.deletedPlayers,
          deletedInstallations: result.deletedInstallations,
        },
        'Workspace data deleted after app uninstall',
      );
    } catch (error) {
      logger.error(
        'Failed to delete workspace data after app uninstall',
        error,
      );
    }
  });
}
