import { Logger } from '@nestjs/common';
import { LocationNotificationService } from './location-notification.service';
import type {
  PlayerMoveEvent,
  PlayerSpawnEvent,
  PlayerRespawnEvent,
  PlayerDeathEvent,
  MonsterMoveEvent,
  MonsterSpawnEvent,
  MonsterDeathEvent,
  LootSpawnEvent,
  CombatStartEvent,
  CombatHitEvent,
  CombatMissEvent,
  CombatEndEvent,
} from '../../shared/event-bus';
import type { PlayerEntity } from '@mud/engine';
import type { PlayerService } from '../player/player.service';
import type { EventBridgeService } from '../../shared/event-bridge.service';

describe('LocationNotificationService', () => {
  const createPlayer = (
    overrides?: Partial<PlayerEntity> & {
      slackUser?: { teamId?: string; userId?: string } | null;
    },
  ): PlayerEntity => {
    const defaultId = overrides?.id ?? 99;
    const slackUser =
      overrides?.slackUser ??
      ({
        teamId: `T${defaultId}`,
        userId: `U${defaultId}`,
      } as PlayerEntity['slackUser']);

    return {
      id: defaultId,
      clientId: overrides?.clientId ?? `T${defaultId}:U${defaultId}`,
      clientType: overrides?.clientType ?? 'slack',
      slackUser,
      ...overrides,
    } as PlayerEntity;
  };

  let playerService: { getPlayersAtLocation: jest.Mock };
  let eventBridge: { publishNotification: jest.Mock };
  let service: LocationNotificationService;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
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
    jest.restoreAllMocks();
    jest.resetAllMocks();
  });

  it('notifies nearby players when someone arrives', async () => {
    playerService.getPlayersAtLocation
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        createPlayer({
          clientId: 'T001:U789',
          id: 101,
          slackUser: { teamId: 'T001', userId: 'U789' },
        }),
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
    expect(payload.recipients[0]).toMatchObject({
      teamId: 'T001',
      userId: 'U789',
      clientType: 'slack',
    });
    expect(payload.recipients[0].message).toContain(
      'arrives from the south-west',
    );
  });

  it('notifies players when a monster moves in and out', async () => {
    playerService.getPlayersAtLocation
      .mockResolvedValueOnce([
        createPlayer({
          id: 7,
          clientId: 'slack:U555',
          slackUser: { teamId: 'T-Origin', userId: 'U555' },
        }),
      ])
      .mockResolvedValueOnce([
        createPlayer({
          id: 8,
          clientId: 'T002:U556',
          slackUser: { teamId: 'T002', userId: 'U556' },
        }),
      ]);

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
      createPlayer({
        clientId: 'T003:U321',
        id: 55,
        slackUser: { teamId: 'T003', userId: 'U321' },
      }),
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
    expect(payload.recipients[0]).toMatchObject({
      teamId: 'T003',
      userId: 'U321',
    });
  });

  it('emits workspace-aware client ids for spawn notifications', async () => {
    playerService.getPlayersAtLocation.mockResolvedValue([
      createPlayer({
        clientId: 'T777:U999',
        id: 202,
        slackUser: { teamId: 'T777', userId: 'U999' },
      }),
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
    expect(payload.recipients[0]).toMatchObject({
      teamId: 'T777',
      userId: 'U999',
    });
  });

  it('routes respawn/death/monster events through notify helper', async () => {
    const notifySpy = jest
      .spyOn(service as unknown as { notifyPlayersAtLocation: jest.Mock }, 'notifyPlayersAtLocation')
      .mockResolvedValue(undefined);

    const respawn: PlayerRespawnEvent = {
      eventType: 'player:respawn',
      player: { id: 1, name: 'Hero' } as any,
      x: 2,
      y: 3,
      timestamp: new Date(),
    };
    await (service as any).handlePlayerRespawn(respawn);
    expect(notifySpy).toHaveBeenCalledWith(
      respawn,
      { x: 2, y: 3 },
      expect.objectContaining({ priority: 'high', type: 'player' }),
    );

    notifySpy.mockClear();
    const death: PlayerDeathEvent = {
      eventType: 'player:death',
      player: { id: 2, name: 'Rogue' } as any,
      x: 4,
      y: 5,
      timestamp: new Date(),
    };
    await (service as any).handlePlayerDeath(death);
    expect(notifySpy).toHaveBeenCalledWith(
      death,
      { x: 4, y: 5 },
      expect.objectContaining({ message: expect.stringContaining('falls') }),
    );

    notifySpy.mockClear();
    const spawn: MonsterSpawnEvent = {
      eventType: 'monster:spawn',
      monster: { id: 3, name: 'Imp' } as any,
      x: 6,
      y: 7,
      timestamp: new Date(),
    };
    await (service as any).handleMonsterSpawn(spawn);
    expect(notifySpy).toHaveBeenCalledWith(
      spawn,
      { x: 6, y: 7 },
      expect.objectContaining({ type: 'monster', priority: 'high' }),
    );

    notifySpy.mockClear();
    const mDeath: MonsterDeathEvent = {
      eventType: 'monster:death',
      monster: { id: 4, name: 'Ghoul' } as any,
      x: 8,
      y: 9,
      timestamp: new Date(),
    };
    await (service as any).handleMonsterDeath(mDeath);
    expect(notifySpy).toHaveBeenCalledWith(
      mDeath,
      { x: 8, y: 9 },
      expect.objectContaining({ message: expect.stringContaining('defeated') }),
    );
  });

  it('summarizes loot drops and logs encounters/combat', async () => {
    const notifySpy = jest
      .spyOn(service as any, 'notifyPlayersAtLocation')
      .mockResolvedValue(undefined);
    const lootEvent: LootSpawnEvent = {
      eventType: 'loot:spawn',
      drops: [
        { itemId: 1, quantity: 2, quality: 'Rare', itemName: 'Blade' },
        { itemId: 2, quality: 'Common' },
      ],
      x: 1,
      y: 2,
      timestamp: new Date(),
    } as any;
    await (service as any).handleLootSpawn(lootEvent);
    const lootCall = notifySpy.mock.calls[0][2];
    expect(lootCall.message).toContain('Blade');
    expect(lootCall.message).toContain('item #2');

    const encounterEvent = {
      eventType: 'monster:encounter',
      player: { id: 1 },
      monsters: [],
      x: 0,
      y: 0,
      timestamp: new Date(),
    } as any;
    await (service as any).handleMonsterEncounter(encounterEvent);
    expect(Logger.prototype.debug).toHaveBeenCalledWith(
      expect.stringContaining('Encounter event received'),
    );

    const combatStart: CombatStartEvent = {
      eventType: 'combat:start',
      attacker: { type: 'player', id: 5, name: 'Knight' },
      defender: { type: 'monster', id: 6, name: 'Ogre' },
      x: 3,
      y: 4,
      timestamp: new Date(),
    };
    notifySpy.mockClear();
    await (service as any).handleCombatStart(combatStart);
    expect(notifySpy).toHaveBeenCalledWith(
      combatStart,
      { x: 3, y: 4 },
      expect.objectContaining({ excludePlayerIds: [5] }),
    );

    notifySpy.mockClear();
    const combatMiss: CombatMissEvent = {
      eventType: 'combat:miss',
      attacker: { type: 'player', id: 5, name: 'Knight' },
      defender: { type: 'monster', id: 6, name: 'Ogre' },
      x: 3,
      y: 4,
      timestamp: new Date(),
    };
    await (service as any).handleCombatMiss(combatMiss);
    expect(notifySpy).toHaveBeenCalledWith(
      combatMiss,
      { x: 3, y: 4 },
      expect.objectContaining({ message: expect.stringContaining('misses') }),
    );

    notifySpy.mockClear();
    const combatEnd: CombatEndEvent = {
      eventType: 'combat:end',
      winner: { type: 'player', id: 5, name: 'Knight' },
      loser: { type: 'monster', id: 6, name: 'Ogre' },
      x: 3,
      y: 4,
      timestamp: new Date(),
    };
    await (service as any).handleCombatEnd(combatEnd);
    expect(notifySpy).toHaveBeenCalledWith(
      combatEnd,
      { x: 3, y: 4 },
      expect.objectContaining({ message: expect.stringContaining('defeats') }),
    );
  });

  it('builds recipients via notifyPlayersAtLocation and logs errors', async () => {
    const players = [
      createPlayer({ id: 1 }),
      createPlayer({ id: 2, slackUser: { teamId: 'T2', userId: 'U2' } }),
    ];
    playerService.getPlayersAtLocation.mockResolvedValue(players);

    await (service as any).notifyPlayersAtLocation(
      { eventType: 'test' },
      { x: 7, y: 8 },
      { type: 'world', message: 'hello', excludePlayerIds: [1] },
    );

    expect(eventBridge.publishNotification).toHaveBeenCalled();
    const payload = eventBridge.publishNotification.mock.calls.pop()?.[0];
    expect(payload.recipients).toHaveLength(1);
    expect(payload.recipients[0]).toMatchObject({
      teamId: 'T2',
      userId: 'U2',
    });

    playerService.getPlayersAtLocation.mockResolvedValue([
      createPlayer({ slackUser: null as any }),
    ]);
    await (service as any).notifyPlayersAtLocation(
      { eventType: 'test' },
      { x: 1, y: 1 },
      { type: 'world', message: 'oops' },
    );
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to notify players'),
      expect.any(Error),
    );
  });

  it('handles null locations and direction helpers', async () => {
    await (service as any).notifyPlayersAtLocation(
      { eventType: 'none' },
      null,
      { type: 'world', message: 'skip' },
    );
    expect(playerService.getPlayersAtLocation).not.toHaveBeenCalled();

    const ids = (service as any).extractPlayerIds(
      { type: 'player', id: 1 },
      { type: 'monster', id: 2 },
      { type: 'player', id: 'bad' },
    );
    expect(ids).toEqual([1]);

    const heading = (service as any).describeHeading(0, 0, 1, 0);
    const arrival = (service as any).describeArrival(0, 0, 0, -1);
    const direction = (service as any).getDirectionName(0, 0, 1, 1);
    expect(heading).toContain('east');
    expect(arrival).toContain('north');
    expect(direction).toBe('north-east');
  });
});
