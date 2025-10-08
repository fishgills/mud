import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBus, type PlayerRespawnEvent } from '@mud/engine';
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
    const slackId = event.player.slackId;
    if (!slackId) {
      this.logger.warn(
        `Received player:respawn for player ${event.player.id} without a Slack ID`,
      );
      return;
    }

    const locationText = `(${event.x}, ${event.y})`;
    const message = `🏥 You have been respawned at ${locationText}. Take a moment to recover before heading back into danger.`;

    await this.eventBridge.publishPlayerNotification(event, [
      {
        clientType: 'slack',
        clientId: `slack:${slackId}`,
        message,
        priority: 'high',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*You're back on your feet!*\n\nYou awaken at *${locationText}*.`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Tip: Check your surroundings and regroup before your next move.',
              },
            ],
          },
        ],
      },
    ]);

    this.logger.debug(
      `Sent respawn notification to ${slackId} for location ${locationText}`,
    );
  }
}
