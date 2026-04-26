import type {
  Installation,
  InstallationQuery,
  InstallationStore,
  Logger,
} from '@slack/bolt';
import {
  upsertWorkspaceInstall,
  setBattleforgeChannelId,
  getPrismaClient,
} from '@mud/database';
import { WebClient } from '@slack/web-api';

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
      void this.bootstrapBattleforgeChannel(installation, logger);
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

  private async bootstrapBattleforgeChannel(
    installation: Installation,
    logger?: Logger,
  ): Promise<void> {
    const teamId =
      installation.team?.id ??
      (installation as { teamId?: string }).teamId ??
      undefined;
    const botToken = installation.bot?.token;

    if (!teamId || !botToken) {
      logger?.debug(
        'bootstrapBattleforgeChannel: missing teamId or botToken — skipping',
      );
      return;
    }

    try {
      const prisma = getPrismaClient();
      const web = new WebClient(botToken);

      // Check if workspace already has a channel configured
      const workspace = await prisma.workspace.findUnique({
        where: { workspaceId: teamId },
        select: { battleforgeChannelId: true },
      });

      if (workspace?.battleforgeChannelId) {
        // Verify the channel still exists
        try {
          const info = await web.conversations.info({
            channel: workspace.battleforgeChannelId,
          });
          if (
            info.channel &&
            !(info.channel as { is_archived?: boolean }).is_archived
          ) {
            logger?.debug(
              'bootstrapBattleforgeChannel: channel already exists — skipping',
            );
            return;
          }
        } catch {
          // Channel not found or inaccessible — fall through to create
        }
      }

      // Try to create the channel
      let channelId: string | undefined;
      try {
        const createResult = await web.conversations.create({
          name: 'battleforge',
          is_private: false,
        });
        channelId = createResult.channel?.id;
      } catch (err) {
        const slackError = err as { data?: { error?: string } };
        if (slackError.data?.error === 'name_taken') {
          // Channel exists — find it
          const list = await web.conversations.list({ limit: 1000 });
          const existing = list.channels?.find(
            (ch) => ch.name === 'battleforge',
          );
          channelId = existing?.id;
        } else {
          throw err;
        }
      }

      if (!channelId) {
        logger?.debug(
          'bootstrapBattleforgeChannel: could not determine channel ID',
        );
        return;
      }

      // Bug 4 fix: persist channelId immediately after create, before join/seed
      await setBattleforgeChannelId(teamId, channelId);

      // Ensure the bot is a member (best-effort)
      try {
        await web.conversations.join({ channel: channelId });
      } catch (joinErr) {
        logger?.debug(
          'bootstrapBattleforgeChannel: failed to join channel — non-fatal',
          joinErr,
        );
      }

      // Seed existing members (best-effort)
      try {
        const membersResult = await web.conversations.members({
          channel: channelId,
        });
        const members = membersResult.members ?? [];
        if (members.length > 0) {
          await prisma.slackUser.updateMany({
            where: { teamId, userId: { in: members } },
            data: { inBattleforgeChannel: true },
          });
        }
      } catch (seedErr) {
        logger?.debug(
          'bootstrapBattleforgeChannel: failed to seed members — non-fatal',
          seedErr,
        );
      }

      // Post welcome message
      await web.chat.postMessage({
        channel: channelId,
        text: 'Welcome to BattleForge! Game events show up here.',
      });

      logger?.debug(
        `bootstrapBattleforgeChannel: channel ${channelId} ready for team ${teamId}`,
      );
    } catch (error) {
      // Never block install on channel bootstrap failures
      logger?.debug('bootstrapBattleforgeChannel: error (non-fatal)', error);
    }
  }
}
