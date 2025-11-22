import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EventBus } from '../../shared/event-bus';
import {
  type GameEvent,
  type PlayerMoveEvent,
  type PlayerSpawnEvent,
  type PlayerRespawnEvent,
  type PlayerDeathEvent,
  type MonsterSpawnEvent,
  type MonsterDeathEvent,
  type LootSpawnEvent,
  type MonsterEncounterEvent,
  type CombatStartEvent,
  type CombatHitEvent,
  type CombatMissEvent,
  type CombatEndEvent,
} from '../../shared/event-bus';
import {
  type NotificationMessage,
  type NotificationRecipient,
} from '@mud/redis-client';
import { EventBridgeService } from '../../shared/event-bridge.service';
import { PlayerService } from '../player/player.service';

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
    // this.subscribe<MonsterMoveEvent>('monster:move', (_) =>
    //   this.handleMonsterMove(),
    // );
    this.subscribe<MonsterSpawnEvent>('monster:spawn', (event) =>
      this.handleMonsterSpawn(event),
    );
    this.subscribe<MonsterDeathEvent>('monster:death', (event) =>
      this.handleMonsterDeath(event),
    );
    this.subscribe<LootSpawnEvent>('loot:spawn', (event) =>
      this.handleLootSpawn(event),
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
        message: `${event.player.name} leaves ${this.describeHeading(event.fromX, event.fromY, event.toX, event.toY)}.`,
        excludePlayerIds: exclude,
      },
    );

    await this.notifyPlayersAtLocation(
      event,
      { x: event.toX, y: event.toY },
      {
        type: 'player',
        message: `${event.player.name} arrives ${this.describeArrival(event.fromX, event.fromY, event.toX, event.toY)}.`,
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
        message: `${event.player.name} appears nearby.`,
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
        message: `${event.player.name} respawns nearby.`,
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
        message: `${event.player.name} falls nearby.`,
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
        message: `${event.monster.name} appears nearby.`,
      },
    );
  }

  private async handleMonsterMove(): Promise<void> {
    // if (event.fromX === event.toX && event.fromY === event.toY) {
    //   return;
    // }
    // await this.notifyPlayersAtLocation(
    //   event,
    //   { x: event.fromX, y: event.fromY },
    //   {
    //     type: 'monster',
    //     message: `${event.monster.name} leaves ${this.describeHeading(event.fromX, event.fromY, event.toX, event.toY)}.`,
    //   },
    // );
    // await this.notifyPlayersAtLocation(
    //   event,
    //   { x: event.toX, y: event.toY },
    //   {
    //     type: 'monster',
    //     priority: 'high',
    //     message: `${event.monster.name} moves in ${this.describeArrival(event.fromX, event.fromY, event.toX, event.toY)}.`,
    //   },
    // );
  }

  private async handleMonsterDeath(event: MonsterDeathEvent): Promise<void> {
    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'monster',
        message: `${event.monster.name} is defeated nearby.`,
      },
    );
  }

  private async handleLootSpawn(event: LootSpawnEvent): Promise<void> {
    const drops = Array.isArray(event.drops) ? event.drops : [];
    type LootEventDrop = {
      itemId: number;
      quantity?: number;
      quality?: string | null;
      itemName?: string | null;
    };
    const summary = drops.length
      ? drops
          .map((d: LootEventDrop) => {
            const name = d.itemName || null;
            if (name)
              return `${d.quantity ?? 1}x ${name} (${String(d.quality)})`;
            return `${d.quantity ?? 1}x item #${d.itemId} (${String(d.quality)})`;
          })
          .join(', ')
      : 'some items';

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'world',
        message: `Loot appears nearby: ${summary}.`,
      },
    );
  }

  private async handleMonsterEncounter(
    event: MonsterEncounterEvent,
  ): Promise<void> {
    this.logger.debug(`Encounter event received: ${JSON.stringify(event)}`);
    return;
  }

  private async handleCombatStart(event: CombatStartEvent): Promise<void> {
    const exclude = this.extractPlayerIds(event.attacker, event.defender);

    await this.notifyPlayersAtLocation(
      event,
      { x: event.x, y: event.y },
      {
        type: 'combat',
        priority: 'high',
        message: `Combat erupts nearby between ${event.attacker.name} and ${event.defender.name}.`,
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
        message: `${event.attacker.name} hits ${event.defender.name} for ${event.damage} damage nearby.`,
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
        message: `${event.attacker.name} misses ${event.defender.name} during combat nearby.`,
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
        message: `Combat ends nearby. ${event.winner.name} defeats ${event.loser.name}.`,
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

      const recipients: NotificationRecipient[] = filtered.map((player) => {
        if (!LocationNotificationService.hasSlackUser(player)) {
          throw new Error(
            `Player ${player.name} does not have a Slack user associated.`,
          );
        }

        return {
          clientType: 'slack',
          teamId: player.slackUser.teamId || '',
          userId: player.slackUser.userId || '',
          message: config.message,
          priority: config.priority || 'normal',
          blocks: config.blocks,
        };
      });

      if (filtered.length === 0) {
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

  private extractPlayerIds(
    ...participants: Array<{ type: string; id: number | string }>
  ): number[] {
    return participants
      .filter((participant) => participant.type === 'player')
      .map((participant) => participant.id)
      .filter((id): id is number => typeof id === 'number');
  }

  // Type guard for players that include a slackUser relation.
  public static hasSlackUser(
    player: { name: string } & Record<string, unknown>,
  ): player is { name: string; slackUser: { teamId: string; userId: string } } {
    const slackUser = (
      player as { slackUser?: { teamId?: string; userId?: string } }
    ).slackUser;
    return (
      typeof slackUser === 'object' &&
      slackUser !== null &&
      typeof slackUser.teamId === 'string' &&
      typeof slackUser.userId === 'string'
    );
  }

  private describeLocation(x: number, y: number): string {
    return `(${x}, ${y})`;
  }

  private describeHeading(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): string {
    const direction = this.getDirectionName(fromX, fromY, toX, toY);
    return direction ? `heading ${direction}` : 'heading out';
  }

  private describeArrival(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): string {
    const direction = this.getDirectionName(toX, toY, fromX, fromY);
    return direction ? `from the ${direction}` : 'from nearby';
  }

  private getDirectionName(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): string | null {
    const dx = toX - fromX;
    const dy = toY - fromY;

    if (dx === 0 && dy === 0) {
      return null;
    }

    const vertical = dy === 0 ? '' : dy > 0 ? 'north' : 'south';
    const horizontal = dx === 0 ? '' : dx > 0 ? 'east' : 'west';

    if (vertical && horizontal) {
      return `${vertical}-${horizontal}`;
    }

    return vertical || horizontal || null;
  }
}
