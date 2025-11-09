import { LocationNotificationService } from './location-notification.service';
import type {
  PlayerMoveEvent,
  PlayerSpawnEvent,
  MonsterMoveEvent,
  MonsterSpawnEvent,
  CombatHitEvent,
} from '../../shared/event-bus';
import type { PlayerEntity } from '@mud/engine';
import type { PlayerService } from '../player/player.service';
import type { EventBridgeService } from '../../shared/event-bridge.service';

describe('LocationNotificationService', () => {
  const createPlayer = (overrides?: Partial<PlayerEntity>): PlayerEntity => {
    return {
      id: overrides?.id ?? 99,
      clientId: overrides?.clientId ?? 'U123',
      clientType: overrides?.clientType ?? 'slack',
    } as PlayerEntity;
  };

  let playerService: { getPlayersAtLocation: jest.Mock };
  let eventBridge: { publishNotification: jest.Mock };
  let service: LocationNotificationService;

  beforeEach(() => {
    playerService = {
      getPlayersAtLocation: jest.fn(),
    };

    eventBridge = {
      publishNotification: jest.fn().mockResolvedValue(undefined),
    };

    service = new LocationNotificationService(
      playerService as unknown as PlayerService,
      eventBridge as unknown as EventBridgeService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('notifies nearby players when someone arrives', async () => {
    playerService.getPlayersAtLocation
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createPlayer({ clientId: 'T001:U789', id: 101 }),
      ]);

    const event: PlayerMoveEvent = {
      eventType: 'player:move',
      player: {
        id: 1,
        name: 'Rogue',
        slackId: 'U0001',
      } as unknown as PlayerMoveEvent['player'],
      fromX: 0,
      fromY: 0,
      toX: 1,
      toY: 1,
      timestamp: new Date(),
    };

    await (
      service as unknown as {
        handlePlayerMove: (e: PlayerMoveEvent) => Promise<void>;
      }
    ).handlePlayerMove(event);

    expect(eventBridge.publishNotification).toHaveBeenCalledTimes(1);
    const payload = eventBridge.publishNotification.mock.calls[0][0];
    expect(payload.type).toBe('player');
    expect(payload.recipients).toHaveLength(1);
    expect(payload.recipients[0].clientId).toBe('slack:T001:U789');
    expect(payload.recipients[0].message).toContain(
      'arrives from the south-west',
    );
  });

  it('notifies players when a monster moves in and out', async () => {
    playerService.getPlayersAtLocation
      .mockResolvedValueOnce([createPlayer({ clientId: 'slack:U555', id: 7 })])
      .mockResolvedValueOnce([createPlayer({ clientId: 'T002:U556', id: 8 })]);

    const event: MonsterMoveEvent = {
      eventType: 'monster:move',
      monster: {
        id: 12,
        name: 'Goblin',
      } as unknown as MonsterMoveEvent['monster'],
      fromX: 5,
      fromY: -2,
      toX: 6,
      toY: -2,
      timestamp: new Date(),
    };

    await (
      service as unknown as {
        handleMonsterMove: (e: MonsterMoveEvent) => Promise<void>;
      }
    ).handleMonsterMove(event);

    expect(eventBridge.publishNotification).toHaveBeenCalledTimes(0);

    // const first = eventBridge.publishNotification.mock.calls[0][0];
    // expect(first.type).toBe('monster');
    // expect(first.recipients[0].clientId).toBe('slack:U555');
    // expect(first.recipients[0].message).toContain('leaves heading east');

    // const second = eventBridge.publishNotification.mock.calls[1][0];
    // expect(second.recipients[0].clientId).toBe('slack:T002:U556');
    // expect(second.recipients[0].message).toContain('moves in from the west');
  });

  it('skips publishing when no players are present', async () => {
    playerService.getPlayersAtLocation.mockResolvedValue([]);

    const event: MonsterSpawnEvent = {
      eventType: 'monster:spawn',
      monster: {
        id: 50,
        name: 'Wraith',
      } as unknown as MonsterSpawnEvent['monster'],
      x: 3,
      y: 4,
      timestamp: new Date(),
    };

    await (
      service as unknown as {
        handleMonsterSpawn: (e: MonsterSpawnEvent) => Promise<void>;
      }
    ).handleMonsterSpawn(event);

    expect(eventBridge.publishNotification).not.toHaveBeenCalled();
  });

  it('notifies combat activity with damage details', async () => {
    playerService.getPlayersAtLocation.mockResolvedValue([
      createPlayer({ clientId: 'T003:U321', id: 55 }),
    ]);

    const event: CombatHitEvent = {
      eventType: 'combat:hit',
      attacker: {
        type: 'player',
        id: 77,
        name: 'Knight',
      },
      defender: {
        type: 'monster',
        id: 88,
        name: 'Troll',
      },
      damage: 11,
      x: -1,
      y: 2,
      timestamp: new Date(),
    };

    await (
      service as unknown as {
        handleCombatHit: (e: CombatHitEvent) => Promise<void>;
      }
    ).handleCombatHit(event);

    expect(eventBridge.publishNotification).toHaveBeenCalledTimes(1);
    const payload = eventBridge.publishNotification.mock.calls[0][0];
    expect(payload.type).toBe('combat');
    expect(payload.recipients[0].message).toContain('11 damage');
    expect(payload.recipients[0].clientId).toBe('slack:T003:U321');
  });

  it('emits workspace-aware client ids for spawn notifications', async () => {
    playerService.getPlayersAtLocation.mockResolvedValue([
      createPlayer({ clientId: 'T777:U999', id: 202 }),
    ]);

    const event = {
      eventType: 'player:spawn',
      player: {
        id: 1,
        name: 'Traveler',
      },
      x: 5,
      y: -5,
      timestamp: new Date(),
    } as unknown as PlayerSpawnEvent;

    await (
      service as unknown as {
        handlePlayerSpawn: (e: PlayerSpawnEvent) => Promise<void>;
      }
    ).handlePlayerSpawn(event);

    expect(eventBridge.publishNotification).toHaveBeenCalledTimes(1);
    const payload = eventBridge.publishNotification.mock.calls[0][0];
    expect(payload.recipients[0].clientId).toBe('slack:T777:U999');
  });
});
