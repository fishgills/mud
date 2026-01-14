import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { getPrismaClient } from '@mud/database';
import { type NotificationRecipient } from '@mud/redis-client';
import {
  EventBus,
  type PlayerLevelUpEvent,
  type PlayerRespawnEvent,
} from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';

@Injectable()
export class PlayerNotificationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PlayerNotificationService.name);
  private readonly subscriptions: Array<() => void> = [];
  private readonly prisma = getPrismaClient();

  constructor(private readonly eventBridge: EventBridgeService) {}

  onModuleInit(): void {
    this.subscriptions.push(
      EventBus.on('player:respawn', (event) =>
        this.handlePlayerRespawn(event as PlayerRespawnEvent),
      ),
    );
    this.subscriptions.push(
      EventBus.on('player:levelup', (event) =>
        this.handlePlayerLevelUp(event as PlayerLevelUpEvent),
      ),
    );
  }

  onModuleDestroy(): void {
    for (const unsubscribe of this.subscriptions) {
      try {
        unsubscribe();
      } catch (error) {
        this.logger.error('Error unsubscribing from event listener', error);
      }
    }
    this.subscriptions.length = 0;
  }

  private async handlePlayerRespawn(event: PlayerRespawnEvent): Promise<void> {
    if (!event.player.slackUser?.teamId || !event.player.slackUser.userId) {
      this.logger.warn(
        `Received player:respawn for player ${event.player.id} without a Slack user`,
      );
      return;
    }

    const message =
      '💀 You were defeated in combat and have recovered. Take a moment to regroup before diving back in.';

    await this.eventBridge.publishPlayerNotification(event, [
      {
        clientType: 'slack',
        teamId: event.player.slackUser.teamId,
        userId: event.player.slackUser.userId,
        message,
        priority: 'high',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*You were defeated.*\n\nYou regain consciousness and feel ready to continue.',
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Tip: Catch your breath and prepare before your next fight.',
              },
            ],
          },
        ],
      },
    ]);

    this.logger.debug(
      `Sent respawn notification to ${event.player.slackUser.teamId}:${event.player.slackUser.userId}`,
    );
  }

  private async handlePlayerLevelUp(event: PlayerLevelUpEvent): Promise<void> {
    const playerId = event.player?.id;
    if (!playerId) {
      this.logger.warn('Received player:levelup without a player id');
      return;
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: { slackUser: true },
    });

    if (!player?.slackUser?.teamId || !player.slackUser.userId) {
      this.logger.warn(
        `Received player:levelup for player ${playerId} without a Slack user`,
      );
      return;
    }

    const recipients: NotificationRecipient[] = [];
    const skillPoints = Math.max(0, event.skillPointsGained ?? 0);
    const skillPointText =
      skillPoints > 0
        ? ` You gained ${skillPoints} skill point${skillPoints === 1 ? '' : 's'}.`
        : '';

    recipients.push({
      clientType: 'slack',
      teamId: player.slackUser.teamId,
      userId: player.slackUser.userId,
      message: `🎉 You reached level ${event.newLevel}!${skillPointText}`,
      priority: 'high',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Level up!*\nYou reached level ${event.newLevel}.${skillPointText}`,
          },
        },
        ...(skillPoints > 0
          ? [
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: 'Tip: Spend skill points from the stats menu.',
                  },
                ],
              },
            ]
          : []),
      ],
    });

    const membership = await this.prisma.guildMember.findUnique({
      where: { playerId },
    });

    if (membership) {
      const members = await this.prisma.guildMember.findMany({
        where: { guildId: membership.guildId },
        include: {
          player: {
            include: {
              slackUser: true,
            },
          },
        },
      });

      for (const member of members) {
        if (member.player.id === player.id) continue;
        const slackUser = member.player.slackUser;
        if (!slackUser) continue;
        recipients.push({
          clientType: 'slack',
          teamId: slackUser.teamId,
          userId: slackUser.userId,
          message: `🎉 ${player.name} reached level ${event.newLevel}!`,
          priority: 'normal',
        });
      }
    }

    if (!recipients.length) {
      return;
    }

    await this.eventBridge.publishPlayerNotification(event, recipients);

    this.logger.debug(
      `Sent level-up notification for player ${player.id} to ${recipients.length} recipient(s)`,
    );
  }
}
