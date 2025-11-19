import { Injectable, Logger } from '@nestjs/common';
import type { GuildTeleportResponse } from '@mud/api-contracts';
import { EventBus } from '../../shared/event-bus';
import { GuildEventType } from '@mud/event-bus';

@Injectable()
export class TeleportPublisher {
  private readonly logger = new Logger(TeleportPublisher.name);

  async emitTeleport(response: GuildTeleportResponse): Promise<void> {
    try {
      await EventBus.emit({
        eventType: GuildEventType.TeleportArrived,
        playerId: Number(response.playerId),
        occupantIds: response.occupantsNotified
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id)) as number[],
        services: response.services,
        arrivalMessage: response.arrivalMessage,
        correlationId: response.correlationId,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.warn('Failed to emit guild teleport event', error as Error);
    }
  }
}
