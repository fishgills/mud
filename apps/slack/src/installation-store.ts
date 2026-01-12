import type {
  Installation,
  InstallationQuery,
  InstallationStore,
  Logger,
} from '@slack/bolt';
import { upsertWorkspaceInstall } from '@mud/database';

export class TrackingInstallationStore implements InstallationStore {
  constructor(private readonly baseStore: InstallationStore) {}

  async storeInstallation(
    installation: Installation,
    logger?: Logger,
  ): Promise<void> {
    await this.baseStore.storeInstallation(installation, logger);
    const teamId =
      installation.team?.id ??
      (installation as { teamId?: string }).teamId ??
      undefined;
    if (teamId) {
      await upsertWorkspaceInstall(teamId);
    }
  }

  fetchInstallation(
    query: InstallationQuery<boolean>,
    logger?: Logger,
  ): Promise<Installation> {
    return this.baseStore.fetchInstallation(query, logger);
  }

  async deleteInstallation(
    query: InstallationQuery<boolean>,
    logger?: Logger,
  ): Promise<void> {
    if (this.baseStore.deleteInstallation) {
      await this.baseStore.deleteInstallation(query, logger);
    }
  }
}
