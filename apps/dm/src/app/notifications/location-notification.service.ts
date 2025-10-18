import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  EventBus,
  type GameEvent,
  type PlayerMoveEvent,
  type PlayerSpawnEvent,
  type PlayerRespawnEvent,
  type PlayerDeathEvent,
  type MonsterMoveEvent,
  type MonsterSpawnEvent,
  type MonsterDeathEvent,
  type MonsterEncounterEvent,
  type CombatStartEvent,
  type CombatHitEvent,
  type CombatMissEvent,
  type CombatEndEvent,
} from '@mud/engine';
import {
  type NotificationMessage,
  type NotificationRecipient,
} from '@mud/redis-client';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerService } from '../player/player.service';
import type { PlayerEntity } from '@mud/engine';

interface NotificationConfig {
  type: NotificationMessage['type'];
  message: string;
  priority?: NotificationRecipient['priority'];
  excludePlayerIds?: number[];
  includeDead?: boolean;
  blocks?: Array<Record<string, unknown>>;
}

@Injectable()
export class LocationNotificationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(LocationNotificationService.name);
  private readonly subscriptions: Array<() => void> = [];

  constructor(
    private readonly playerService: PlayerService,
    private readonly eventBridge: EventBridgeService,
  ) {}

  onModuleInit(): void {
    this.subscribe<PlayerMoveEvent>('player:move', (event) =>
      this.handlePlayerMove(event),
    );
    this.subscribe<PlayerSpawnEvent>('player:spawn', (event) =>
      this.handlePlayerSpawn(event),
    );
    this.subscribe<PlayerRespawnEvent>('player:respawn', (event) =>
      this.handlePlayerRespawn(event),
    );
    this.subscribe<PlayerDeathEvent>('player:death', (event) =>
      this.handlePlayerDeath(event),
    );
    this.subscribe<MonsterMoveEvent>('monster:move', (event) =>
      this.handleMonsterMove(event),
    );
    this.subscribe<MonsterSpawnEvent>('monster:spawn', (event) =>
      this.handleMonsterSpawn(event),
    );
    this.subscribe<MonsterDeathEvent>('monster:death', (event) =>
      this.handleMonsterDeath(event),
    );
    this.subscribe<MonsterEncounterEvent>('monster:encounter', (event) =>
      this.handleMonsterEncounter(event),
    );
    this.subscribe<CombatStartEvent>('combat:start', (event) =>
      this.handleCombatStart(event),
    );
    this.subscribe<CombatHitEvent>('combat:hit', (event) =>
      this.handleCombatHit(event),
    );
    this.subscribe<CombatMissEvent>('combat:miss', (event) =>
      this.handleCombatMiss(event),
    );
    this.subscribe<CombatEndEvent>('combat:end', (event) =>
      this.handleCombatEnd(event),
    );
  }

  onModuleDestroy(): void {
    while (this.subscriptions.length > 0) {
      const unsubscribe = this.subscriptions.pop();
      try {
        unsubscribe?.();
      } catch (error) {
        this.logger.error(
          'Failed to remove event subscription',
          error as Error,
        );
      }
    }
  }

  private subscribe<T extends GameEvent>(
    eventType: T['eventType'],
    handler: (event: T) => Promise<void>,
  ): void {
    const unsubscribe = EventBus.on(eventType, async (event) => {
      try {
        await handler(event as T);
      } catch (error) {
        this.logger.error(
          `Failed to handle ${eventType} notification`,
          error as Error,
        );
      }
    });

    this.subscriptions.push(unsubscribe);
  }

  private async handlePlayerMove(event: PlayerMoveEvent): Promise<void> {
    if (event.fromX === event.toX && event.fromY === event.toY) {
      return;
    }

    const exclude = [event.player.id];

    await this.notifyPlayersAtLocation(
      event,
      { x: event.fromX, y: event.fromY },
      {
        type: 'player',
        message: `${event.player.name} leaves ${this.describeLocation(event.fromX, event.fromY)} heading toward ${this.describeLocation(event.toX, event.toY)}.`,
        excludePlayerIds: exclude,
      },
    );

    await this.notifyPlayersAtLocation(
      event,
      { x: event.toX, y: event.toY },
      {
        type: 'player',
        message: `${event.player.name} arrives at ${this.describeLocation(event.toX, event.toY)} from ${this.describeLocation(event.fromX, event.fromY)}.`,
        excludePlayerIds: exclude,
      },
    );
  }

  private async handlePlayerSpawn(event: PlayerSpawnEvent): Promise<void> {
    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'player',
        message: `${event.player.name} appears at ${this.describeLocation(event.x, event.y)}.`,
        excludePlayerIds: [event.player.id],
      },
    );
  }

  private async handlePlayerRespawn(event: PlayerRespawnEvent): Promise<void> {
    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'player',
        priority: 'high',
        message: `${event.player.name} respawns at ${this.describeLocation(event.x, event.y)}.`,
        excludePlayerIds: [event.player.id],
      },
    );
  }

  private async handlePlayerDeath(event: PlayerDeathEvent): Promise<void> {
    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'player',
        priority: 'high',
        message: `${event.player.name} falls at ${this.describeLocation(event.x, event.y)}.`,
      },
    );
  }

  private async handleMonsterSpawn(event: MonsterSpawnEvent): Promise<void> {
    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'monster',
        priority: 'high',
        message: `${event.monster.name} appears at ${this.describeLocation(event.x, event.y)}.`,
      },
    );
  }

  private async handleMonsterMove(event: MonsterMoveEvent): Promise<void> {
    if (event.fromX === event.toX && event.fromY === event.toY) {
      return;
    }

    await this.notifyPlayersAtLocation(
      event,
      { x: event.fromX, y: event.fromY },
      {
        type: 'monster',
        message: `${event.monster.name} leaves ${this.describeLocation(event.fromX, event.fromY)} heading toward ${this.describeLocation(event.toX, event.toY)}.`,
      },
    );

    await this.notifyPlayersAtLocation(
      event,
      { x: event.toX, y: event.toY },
      {
        type: 'monster',
        priority: 'high',
        message: `${event.monster.name} moves into ${this.describeLocation(event.toX, event.toY)} from ${this.describeLocation(event.fromX, event.fromY)}.`,
      },
    );
  }

  private async handleMonsterDeath(event: MonsterDeathEvent): Promise<void> {
    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'monster',
        message: `${event.monster.name} is defeated at ${this.describeLocation(event.x, event.y)}.`,
      },
    );
  }

  private async handleMonsterEncounter(
    event: MonsterEncounterEvent,
  ): Promise<void> {
    const monsterSummary =
      event.monsters.length === 1
        ? event.monsters[0].name
        : `${event.monsters.length} monsters`;

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'monster',
        priority: 'high',
        message: `${event.player.name} encounters ${monsterSummary} at ${this.describeLocation(event.x, event.y)}.`,
        excludePlayerIds: [event.player.id],
      },
    );
  }

  private async handleCombatStart(event: CombatStartEvent): Promise<void> {
    const exclude = this.extractPlayerIds(event.attacker, event.defender);

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'combat',
        priority: 'high',
        message: `Combat erupts between ${event.attacker.name} and ${event.defender.name} at ${this.describeLocation(event.x, event.y)}.`,
        excludePlayerIds: exclude,
      },
    );
  }

  private async handleCombatHit(event: CombatHitEvent): Promise<void> {
    const exclude = this.extractPlayerIds(event.attacker, event.defender);

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'combat',
        priority: 'high',
        message: `${event.attacker.name} hits ${event.defender.name} for ${event.damage} damage at ${this.describeLocation(event.x, event.y)}.`,
        excludePlayerIds: exclude,
      },
    );
  }

  private async handleCombatMiss(event: CombatMissEvent): Promise<void> {
    const exclude = this.extractPlayerIds(event.attacker, event.defender);

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'combat',
        message: `${event.attacker.name} misses ${event.defender.name} during combat at ${this.describeLocation(event.x, event.y)}.`,
        excludePlayerIds: exclude,
      },
    );
  }

  private async handleCombatEnd(event: CombatEndEvent): Promise<void> {
    const exclude = this.extractPlayerIds(event.winner, event.loser);

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'combat',
        priority: 'high',
        message: `Combat ends at ${this.describeLocation(event.x, event.y)}. ${event.winner.name} defeats ${event.loser.name}.`,
        excludePlayerIds: exclude,
      },
    );
  }

  // Send a single formatted notification to all slack players at the location.
  private async notifyPlayersAtLocation<T extends GameEvent>(
    event: T,
    location: { x: number; y: number } | null,
    config: NotificationConfig,
  ): Promise<void> {
    if (!location) {
      return;
    }

    const { x, y } = location;

    try {
      const players = await this.playerService.getPlayersAtLocation(x, y, {
        aliveOnly: config.includeDead ? false : true,
      });

      const filtered = config.excludePlayerIds?.length
        ? players.filter(
            (player) => !config.excludePlayerIds!.includes(player.id),
          )
        : players;

      const recipients = this.buildSlackRecipients(
        filtered,
        config.message,
        config.priority,
        config.blocks,
      );

      if (recipients.length === 0) {
        return;
      }

      await this.eventBridge.publishNotification({
        type: config.type,
        recipients,
        event,
      });

      this.logger.debug(
        `Sent ${config.type} notification to ${recipients.length} player(s) at ${this.describeLocation(x, y)}.`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to notify players at ${this.describeLocation(x, y)}`,
        error as Error,
      );
    }
  }

  private buildSlackRecipients(
    players: PlayerEntity[],
    message: string,
    priority: NotificationRecipient['priority'] = 'normal',
    blocks?: Array<Record<string, unknown>>,
  ): NotificationRecipient[] {
    const recipients = new Map<string, NotificationRecipient>();

    for (const player of players) {
      const slackId = this.extractSlackId(player);
      if (!slackId) {
        continue;
      }

      const clientId = `slack:${slackId}`;
      if (recipients.has(clientId)) {
        continue;
      }

      recipients.set(clientId, {
        clientType: 'slack',
        clientId,
        message,
        priority,
        blocks,
      });
    }

    return Array.from(recipients.values());
  }

  private extractSlackId(
    source:
      | PlayerEntity
      | {
          clientId?: string | null;
          clientType?: string | null;
          slackId?: string | null;
        },
  ): string | null {
    if (!source) {
      return null;
    }

    const clientType =
      (source as PlayerEntity).clientType ??
      (source as { clientType?: string | null }).clientType ??
      null;
    const directClientId =
      (source as PlayerEntity).clientId ??
      (source as { clientId?: string | null }).clientId ??
      null;
    const slackId = (source as { slackId?: string | null }).slackId ?? null;

    if (clientType === 'slack' && directClientId) {
      return this.normalizeSlackId(directClientId);
    }

    if (slackId) {
      return this.normalizeSlackId(slackId);
    }

    if (directClientId) {
      return this.normalizeSlackId(directClientId);
    }

    return null;
  }

  private normalizeSlackId(raw: string | null): string | null {
    if (!raw) {
      return null;
    }

    let value = raw.trim();
    while (value.toLowerCase().startsWith('slack:')) {
      value = value.slice('slack:'.length);
    }

    return value.length > 0 ? value : null;
  }

  private extractPlayerIds(
    ...participants: Array<{ type: string; id: number | string }>
  ): number[] {
    return participants
      .filter((participant) => participant.type === 'player')
      .map((participant) => participant.id)
      .filter((id): id is number => typeof id === 'number');
  }

  private describeLocation(x: number, y: number): string {
    return `(${x}, ${y})`;
  }
}
