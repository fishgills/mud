import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { getPrismaClient, RunStatus } from '@mud/database';
import { EventBus, type RunEndEvent } from '../../shared/event-bus';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { buildBattleforgeRecipients } from '../../shared/battleforge-channel.recipients';

@Injectable()
export class RunsPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RunsPublisher.name);
  private readonly prisma = getPrismaClient();
  private unsubscribe?: () => void;

  constructor(private readonly eventBridge: EventBridgeService) {}

  onModuleInit(): void {
    this.unsubscribe = EventBus.on('run:end', (event) =>
      this.handleRunEnd(event as RunEndEvent),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handleRunEnd(event: RunEndEvent): Promise<void> {
    // Only post to #battleforge for successfully cashed-out runs
    if (event.status !== RunStatus.CASHED_OUT) {
      return;
    }

    try {
      // Resolve guild name and participant count
      let guildName: string | undefined;
      let participantCount = 0;

      if (event.guildId) {
        const guild = await this.prisma.guild.findUnique({
          where: { id: event.guildId },
          select: { name: true },
        });
        guildName = guild?.name;
      }

      const participants = await this.prisma.runParticipant.findMany({
        where: { runId: event.runId },
        select: { id: true },
      });
      participantCount = participants.length;

      const partyLabel = guildName ?? 'A party';
      const xp = event.bankedXp;
      const gold = event.bankedGold;
      const countSuffix =
        participantCount > 1 ? ` (${participantCount} members)` : '';
      const message = `⚔️ ${partyLabel}${countSuffix} completed a raid — ${xp} XP, ${gold} gold.`;

      const channelRecipients = await buildBattleforgeRecipients(message);
      if (channelRecipients.length > 0) {
        await this.eventBridge.publishNotification({
          type: 'run',
          event,
          recipients: channelRecipients,
        });
      }
    } catch (error) {
      this.logger.warn(
        'Failed to publish run:end to #battleforge',
        error as Error,
      );
    }
  }
}
