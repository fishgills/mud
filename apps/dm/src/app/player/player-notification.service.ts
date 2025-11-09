import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBus, type PlayerRespawnEvent } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { LocationNotificationService } from '../notifications/location-notification.service';

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
    if (!LocationNotificationService.hasSlackUser(event.player)) {
      this.logger.warn(
        `Received player:respawn for player ${event.player.id} without a Slack user`,
      );
      return;
    }

    const locationText = `(${event.x}, ${event.y})`;
    const message = `🏥 You have been respawned at ${locationText}. Take a moment to recover before heading back into danger.`;

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
      `Sent respawn notification to ${event.player.slackUser.teamId}:${event.player.slackUser.userId} for location ${locationText}`,
    );
  }

  private resolveSlackUserId(player: {
    clientId: string | null;
    clientType: string | null;
  }): string | null {
    const clientId = player.clientId?.trim();
    if (!clientId) {
      return null;
    }

    const clientType = (player.clientType ?? 'slack').trim().toLowerCase();
    if (clientType !== 'slack') {
      return null;
    }

    const segments = clientId
      .split(':')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0);

    if (segments.length === 0) {
      return null;
    }

    if (segments[0].toLowerCase() === 'slack') {
      segments.shift();
    }

    if (segments.length === 0) {
      return null;
    }

    return segments[segments.length - 1];
  }
}
