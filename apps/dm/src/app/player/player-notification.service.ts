import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBus, type PlayerRespawnEvent } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';

@Injectable()
export class PlayerNotificationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PlayerNotificationService.name);
  private readonly subscriptions: Array<() => void> = [];

  constructor(private readonly eventBridge: EventBridgeService) {}

  onModuleInit(): void {
    this.subscriptions.push(
      EventBus.on('player:respawn', (event) =>
        this.handlePlayerRespawn(event as PlayerRespawnEvent),
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
}
