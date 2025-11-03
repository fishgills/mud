// Mocks for engine and database before importing the service
jest.mock('@mud/engine', () => {
  // Use a single shared EventBus instance stored on globalThis so that
  // both the test file and any modules under test reference the exact
  // same listeners/implementation. This avoids subtle mocking issues
  // where different closures hold different listener arrays.
  const globalKey = '__TEST_EVENT_BUS__';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore - attach test helper to globalThis
  if (!(globalThis as any)[globalKey]) {
    (globalThis as any)[globalKey] = (() => {
      const listeners: Array<(ev: unknown) => Promise<void> | void> = [];
      const bus = {
        on: jest.fn(
          (
            eventType: string,
            handler: (ev: unknown) => Promise<void> | void,
          ) => {
            listeners.push(handler);
            // expose last registered and the array for test introspection
            (bus as any).__lastRegistered = handler;
            (bus as any).__listeners = listeners;
            return () => {
              const idx = listeners.indexOf(handler);
              if (idx >= 0) listeners.splice(idx, 1);
            };
          },
        ),
        emit: jest.fn(async (ev: unknown) => {
          for (const h of [...listeners]) {
            // await in case handlers are async
            // eslint-disable-next-line no-await-in-loop
            await (h as any)(ev);
          }
          return Promise.resolve();
        }),
        clear: jest.fn(() => {
          listeners.length = 0;
        }),
        // placeholders that will be filled when handlers are registered
        __lastRegistered: undefined as unknown,
        __listeners: listeners as unknown,
      } as unknown as {
        on: (
          eventType: string,
          handler: (ev: unknown) => Promise<void> | void,
        ) => () => void;
        emit: (ev: unknown) => Promise<void>;
        clear: () => void;
        __lastRegistered: unknown;
        __listeners: unknown;
      };

      return bus;
    })();
  }

  const sharedBus = (globalThis as any)[globalKey];

  return {
    MonsterFactory: {
      load: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    },
    EventBus: sharedBus,
  };
});

import { CombatService, Combatant } from './combat.service';
import { MonsterFactory, EventBus } from '@mud/engine';
import type { PlayerEntity, CombatInitiateEvent } from '@mud/engine';
import type { EventBridgeService } from '../../shared/event-bridge.service';
import type { PlayerService } from '../player/player.service';
import type { AiService } from '../../openai/ai.service';
import type { CombatRound, DetailedCombatLog, CombatResult } from '../api';
import type { ItemQuality } from '@prisma/client';

describe('CombatService (unit)', () => {
  const makePlayer = (overrides: any = {}) => ({
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Attacker',
    combat: {
      hp: overrides.hp ?? 10,
      maxHp: 10,
      isAlive: overrides.isAlive ?? true,
    },
    attributes: { strength: overrides.str ?? 12, agility: overrides.agi ?? 12 },
    level: overrides.level ?? 1,
    position: { x: overrides.x ?? 0, y: overrides.y ?? 0 },
    clientType: 'slack',
    clientId: overrides.clientId ?? 'S1',
    xp: overrides.xp ?? 0,
    gold: overrides.gold ?? 0,
  });

  beforeEach(() => jest.resetAllMocks());

  test('blocks combat when players are in different locations', async () => {
    const playerService: any = {
      getPlayer: jest
        .fn()
        .mockResolvedValueOnce(makePlayer({ name: 'A', x: 0, y: 0 })),
      getPlayerByClientId: jest.fn(),
      getPlayersAtLocation: jest.fn().mockResolvedValue([]),
      respawnPlayer: jest.fn().mockResolvedValue({
        player: makePlayer(),
        event: undefined,
      }),
    };
    const aiService: any = { getText: jest.fn() };
    const eventBridge: any = { publishCombatNotifications: jest.fn() };

    // defender at different location
    playerService.getPlayer.mockResolvedValueOnce(
      makePlayer({ name: 'B', x: 1, y: 1 }),
    );

    const svc = new CombatService(playerService, aiService, eventBridge);

    await expect(svc.playerAttackPlayer('A', 'B')).rejects.toThrow(
      'Target is not at your location',
    );
  });

  test('blocks combat when one combatant is dead', async () => {
    const playerService: any = {
      getPlayer: jest
        .fn()
        .mockResolvedValue(makePlayer({ name: 'A', isAlive: false })),
      getPlayerByClientId: jest.fn(),
      getPlayersAtLocation: jest.fn().mockResolvedValue([]),
      respawnPlayer: jest.fn().mockResolvedValue({
        player: makePlayer(),
        event: undefined,
      }),
    };
    const aiService: any = { getText: jest.fn() };
    const eventBridge: any = { publishCombatNotifications: jest.fn() };

    const svc = new CombatService(playerService, aiService, eventBridge);
    await expect(svc.playerAttackPlayer('A', 'B')).rejects.toThrow(
      'One or both combatants are dead',
    );
  });

  test('successful player vs player runs, applies results, and publishes notifications', async () => {
    // First, craft deterministic combat log returned by engine.runCombat
    const predeterminedLog: any = {
      combatId: 'c-test',
      participant1: 'Attacker',
      participant2: 'Defender',
      firstAttacker: 'Attacker',
      initiativeRolls: [],
      rounds: [
        {
          roundNumber: 1,
          attackerName: 'Attacker',
          defenderName: 'Defender',
          attackRoll: 15,
          attackModifier: 2,
          totalAttack: 17,
          defenderAC: 12,
          hit: true,
          damage: 5,
          defenderHpAfter: 0,
          killed: true,
        },
      ],
      winner: 'Attacker',
      loser: 'Defender',
      xpAwarded: 10,
      goldAwarded: 3,
      timestamp: new Date(),
      location: { x: 0, y: 0 },
    };

    const playerA = makePlayer({
      id: 1,
      name: 'Attacker',
      clientId: 'S-A',
      x: 0,
      y: 0,
    });
    const playerB = makePlayer({
      id: 2,
      name: 'Defender',
      clientId: 'S-B',
      x: 0,
      y: 0,
    });

    const playerService: any = {
      getPlayer: jest.fn().mockImplementation((id: string) => {
        if (id === 'Attacker' || id === 'S-A') return Promise.resolve(playerA);
        if (id === 'Defender' || id === 'S-B') return Promise.resolve(playerB);
        return Promise.resolve(null);
      }),
      getPlayerByClientId: jest.fn().mockResolvedValue(null),
      getPlayersAtLocation: jest
        .fn()
        .mockResolvedValue([
          { id: 3, name: 'Obs', clientType: 'slack', clientId: 'S-OBS' },
        ]),
      respawnPlayer: jest.fn().mockResolvedValue({
        player: makePlayer(),
        event: undefined,
      }),
      updatePlayerStats: jest.fn().mockResolvedValue({
        level: playerA.level,
        skillPoints: 0,
        combat: { maxHp: 10, hp: playerA.combat.hp },
      }),
      getPlayerById: jest.fn(),
      getPlayerByName: jest.fn(),
    };

    const aiService: any = {
      getText: jest.fn().mockResolvedValue({ output_text: '' }),
    };
    const eventBridge: any = {
      publishCombatNotifications: jest.fn().mockResolvedValue(true),
    };

    // Ensure MonsterFactory.delete isn't used in this path
    (MonsterFactory.delete as jest.Mock).mockResolvedValue(true);

    const eventBusEmit = EventBus.emit as jest.Mock;
    eventBusEmit.mockClear();

    const svc = new CombatService(playerService, aiService, eventBridge);
    // stub the internal runCombat on this instance for deterministic behaviour
    const runCombatSpy = jest
      .spyOn(svc as any, 'runCombat')
      .mockResolvedValue(predeterminedLog);
    const respawnEvent = {
      eventType: 'player:respawn',
      player: { id: playerB.id },
    } as Record<string, unknown>;
    const applyResultsSpy = jest
      .spyOn(svc as any, 'applyCombatResults')
      .mockResolvedValue({ playerRespawnEvents: [respawnEvent] });

    const result = await svc.playerAttackPlayer('Attacker', 'Defender');

    expect(result.success).toBe(true);
    expect(result.winnerName).toBe('Attacker');
    // match the xp/gold values we injected in the mocked combat log
    expect(result.xpGained).toBe(10);
    expect(result.goldGained).toBe(3);
    expect(result.roundsCompleted).toBe(1);
    expect(result.totalDamageDealt).toBe(5);
    expect(result.playerMessages.some((m) => m.role === 'observer')).toBe(true);
    expect(eventBridge.publishCombatNotifications).toHaveBeenCalled();
    expect(applyResultsSpy).toHaveBeenCalled();
    expect(runCombatSpy).toHaveBeenCalled();
    expect(eventBusEmit).toHaveBeenCalledWith(respawnEvent);
    const publishOrder = (eventBridge.publishCombatNotifications as jest.Mock)
      .mock.invocationCallOrder[0];
    const emitOrder = eventBusEmit.mock.invocationCallOrder[0];
    expect(emitOrder).toBeGreaterThan(publishOrder);
    // legacy short message preserved
    expect(typeof result.message).toBe('string');
  });
});
type MockPrismaClient = {
  combatLog: {
    findMany: jest.Mock;
    create: jest.Mock;
  };
  monster: {
    findUnique: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
  };
  playerItem: {
    findMany: jest.Mock;
  };
};

function createMockPrisma(): MockPrismaClient {
  return {
    combatLog: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    monster: {
      findUnique: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    playerItem: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
}

function ensureCombatPrismaHolder() {
  const globalObject = globalThis as Record<string, unknown>;
  const key = '__combatPrismaHolder';
  if (!globalObject[key]) {
    globalObject[key] = { current: createMockPrisma() };
  }

  return globalObject[key] as { current: MockPrismaClient };
}

jest.mock('@mud/database', () => {
  const actual =
    jest.requireActual<typeof import('@mud/database')>('@mud/database');

  return {
    ...actual,
    getPrismaClient: () => ensureCombatPrismaHolder().current,
  };
});

const combatPrismaHolder = ensureCombatPrismaHolder();

const accessPrivate = <T>(instance: object, key: string): T =>
  (instance as Record<string, unknown>)[key] as T;

const createHelperService = () => {
  const playerService = {
    getPlayer: jest.fn(),
    updatePlayerStats: jest.fn(),
    respawnPlayer: jest.fn().mockImplementation(async (slackId: string) => ({
      player: createPlayer({ slackId, clientId: slackId }),
      event: undefined,
    })),
  } as unknown as PlayerService;

  const aiService = {
    getText: jest.fn(),
  } as unknown as AiService;

  const eventBridge = {
    publishCombatNotifications: jest.fn().mockResolvedValue(undefined),
  } as unknown as EventBridgeService;

  const service = new CombatService(playerService, aiService, eventBridge);
  return {
    service,
    aiService: aiService as unknown as { getText: jest.Mock },
    eventBridge: eventBridge as unknown as {
      publishCombatNotifications: jest.Mock;
    },
  };
};

describe('CombatService helpers', () => {
  beforeEach(() => {
    combatPrismaHolder.current = createMockPrisma();
    jest.clearAllMocks();
  });

  it('describes combat rounds from the second-person perspective', () => {
    const { service } = createHelperService();
    const describeRound = accessPrivate<
      (round: CombatRound, options?: { secondPersonName?: string }) => string
    >(service, 'describeRound').bind(service);

    const hitRound: CombatRound = {
      roundNumber: 1,
      attackerName: 'Hero',
      defenderName: 'Goblin',
      attackRoll: 15,
      attackModifier: 2,
      totalAttack: 17,
      defenderAC: 12,
      hit: true,
      damage: 6,
      killed: false,
      defenderHpAfter: 4,
    };

    expect(describeRound(hitRound, { secondPersonName: 'Hero' })).toContain(
      'You strike Goblin',
    );
    expect(describeRound(hitRound)).toContain('Hero hits Goblin');
    expect(describeRound(hitRound)).toContain(
      'Attack: d20 15 + 2 = 17 vs AC 12 (HIT)',
    );
    expect(describeRound(hitRound)).toContain('Damage: 6');
  });

  it('falls back to deterministic combat narrative when AI response is empty', async () => {
    const { service, aiService } = createHelperService();
    aiService.getText.mockResolvedValue({ output_text: '' });

    const generateCombatNarrative = accessPrivate<
      (
        log: DetailedCombatLog,
        options?: { secondPersonName?: string },
      ) => Promise<string>
    >(service, 'generateCombatNarrative').bind(service);

    const narrative = await generateCombatNarrative({
      combatId: 'test',
      participant1: 'Hero',
      participant2: 'Goblin',
      initiativeRolls: [],
      firstAttacker: 'Hero',
      rounds: [
        {
          roundNumber: 1,
          attackerName: 'Hero',
          defenderName: 'Goblin',
          attackRoll: 15,
          attackModifier: 2,
          totalAttack: 17,
          defenderAC: 12,
          hit: true,
          damage: 5,
          defenderHpAfter: 3,
          killed: false,
        },
      ],
      winner: 'Hero',
      loser: 'Goblin',
      xpAwarded: 12,
      goldAwarded: 4,
      timestamp: new Date('2023-01-01T00:00:00Z'),
      location: { x: 0, y: 0 },
    });

    expect(aiService.getText).toHaveBeenCalled();
    expect(narrative).toContain('**Combat Summary:**');
    expect(narrative).toContain('Round 1:');
    expect(narrative).toContain('Attack: d20 15 + 2 = 17 vs AC 12 (HIT)');
  });

  it('returns combat logs for a location via the prisma client', async () => {
    const { service } = createHelperService();
    const expected = [{ id: 1 }];
    combatPrismaHolder.current.combatLog.findMany.mockResolvedValue(expected);

    await expect(service.getCombatLogForLocation(3, 4, 2)).resolves.toBe(
      expected,
    );

    expect(combatPrismaHolder.current.combatLog.findMany).toHaveBeenCalledWith({
      where: { x: 3, y: 4 },
      orderBy: { timestamp: 'desc' },
      take: 2,
    });
  });
});

type TestPlayerEntity = PlayerEntity & {
  slackId?: string;
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  x: number;
  y: number;
  isAlive: boolean;
  lastAction: Date;
  createdAt: Date;
  updatedAt: Date;
  worldTileId: number | null;
};

const createPlayer = (
  overrides: Partial<
    TestPlayerEntity & {
      attributes: Partial<PlayerEntity['attributes']>;
      combat: Partial<PlayerEntity['combat']>;
      position: Partial<PlayerEntity['position']>;
    }
  > = {},
): TestPlayerEntity => {
  const attributes = {
    strength: overrides.attributes?.strength ?? overrides.strength ?? 10,
    agility: overrides.attributes?.agility ?? overrides.agility ?? 10,
    health: overrides.attributes?.health ?? overrides.health ?? 10,
  };
  const combat = {
    hp: overrides.combat?.hp ?? overrides.hp ?? 10,
    maxHp: overrides.combat?.maxHp ?? overrides.maxHp ?? 10,
    isAlive: overrides.combat?.isAlive ?? overrides.isAlive ?? true,
  };
  const position = {
    x: overrides.position?.x ?? overrides.x ?? 0,
    y: overrides.position?.y ?? overrides.y ?? 0,
  };

  const player = {
    id: overrides.id ?? 1,
    clientId:
      overrides.clientId ?? (overrides.slackId ? overrides.slackId : 'player'),
    clientType: overrides.clientType ?? 'slack',
    name: overrides.name ?? 'Player',
    gold: overrides.gold ?? 0,
    xp: overrides.xp ?? 0,
    level: overrides.level ?? 1,
    skillPoints: overrides.skillPoints ?? 0,
    partyId: overrides.partyId,
    attributes,
    combat,
    position,
    slackId: overrides.slackId ?? 'player',
    hp: combat.hp,
    maxHp: combat.maxHp,
    strength: attributes.strength,
    agility: attributes.agility,
    health: attributes.health,
    x: position.x,
    y: position.y,
    isAlive: combat.isAlive,
    lastAction: overrides.lastAction ?? new Date(),
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    worldTileId: overrides.worldTileId ?? null,
  } satisfies Partial<TestPlayerEntity>;

  return player as TestPlayerEntity;
};

type CombatServiceInternals = {
  generateCombatNarrative: (
    combatLog: DetailedCombatLog,
    options?: { secondPersonName?: string },
  ) => Promise<string>;
  applyCombatResults: (
    combatLog: DetailedCombatLog,
    combatant1: Combatant,
    combatant2: Combatant,
  ) => Promise<void>;
  rollInitiative: (agility: number) => {
    roll: number;
    modifier: number;
    total: number;
  };
  rollD20: () => number;
  calculateDamage: (strength: number) => number;
  calculateXpGain: (winnerLevel: number, loserLevel: number) => number;
  calculateGoldReward: (victorLevel: number, targetLevel: number) => number;
  runCombat: (
    combatant1: Combatant,
    combatant2: Combatant,
  ) => Promise<DetailedCombatLog>;
  playerToCombatant: (slackId: string) => Promise<Combatant>;
  monsterToCombatant: (monsterId: number) => Promise<Combatant>;
};

type MockPlayerService = Pick<
  PlayerService,
  | 'getPlayer'
  | 'getPlayerByClientId'
  | 'updatePlayerStats'
  | 'respawnPlayer'
  | 'getPlayersAtLocation'
>;

type MockAiService = Pick<AiService, 'getText'>;

describe('CombatService', () => {
  let service: CombatService;
  let playerService: jest.Mocked<MockPlayerService>;
  let aiService: jest.Mocked<MockAiService>;
  let eventBridge: { publishCombatNotifications: jest.Mock };

  const getInternals = () => service as unknown as CombatServiceInternals;

  beforeEach(() => {
    playerService = {
      getPlayer: jest.fn(),
      getPlayerByClientId: jest.fn().mockRejectedValue(new Error('not found')),
      updatePlayerStats: jest.fn(),
      respawnPlayer: jest.fn().mockImplementation(async (slackId: string) => ({
        player: createPlayer({ slackId, clientId: slackId }),
        event: undefined,
      })),
      getPlayersAtLocation: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<MockPlayerService>;

    playerService.updatePlayerStats.mockImplementation(
      async (slackId: string, stats) => {
        const current = await playerService.getPlayer(slackId);

        if (!current) {
          throw new Error(`Mock player not found for ${slackId}`);
        }

        return {
          ...current,
          xp: typeof stats.xp === 'number' ? stats.xp : current.xp,
          gold: typeof stats.gold === 'number' ? stats.gold : current.gold,
          level: typeof stats.level === 'number' ? stats.level : current.level,
          skillPoints: current.skillPoints,
          combat: {
            ...current.combat,
            hp: typeof stats.hp === 'number' ? stats.hp : current.combat.hp,
          },
        } as PlayerEntity;
      },
    );

    aiService = {
      getText: jest.fn(),
    } as jest.Mocked<MockAiService>;

    eventBridge = {
      publishCombatNotifications: jest.fn().mockResolvedValue(undefined),
    };

    service = new CombatService(
      playerService as unknown as PlayerService,
      aiService as unknown as AiService,
      eventBridge as unknown as EventBridgeService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves player vs player combat with deterministic rolls', async () => {
    const attackerPlayer = createPlayer({
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 12,
      maxHp: 12,
      strength: 16,
      agility: 12,
      level: 3,
      x: 5,
      y: 5,
    });

    const defenderPlayer = createPlayer({
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      hp: 8,
      maxHp: 8,
      strength: 10,
      agility: 10,
      level: 2,
      x: 5,
      y: 5,
    });

    playerService.getPlayer.mockImplementation(async (slackId: string) =>
      slackId === 'attacker' ? attackerPlayer : defenderPlayer,
    );

    const internals = getInternals();

    const narrativeSpy = jest
      .spyOn(internals, 'generateCombatNarrative')
      .mockImplementation(async (_combatLog, options) =>
        options?.secondPersonName === 'Attacker'
          ? 'Attacker POV summary'
          : 'Defender POV summary',
      );
    const applyResultsSpy = jest
      .spyOn(internals, 'applyCombatResults')
      .mockResolvedValue({ playerRespawnEvents: [] });
    const initiativeSpy = jest
      .spyOn(internals, 'rollInitiative')
      .mockImplementationOnce(() => ({ roll: 15, modifier: 2, total: 17 }))
      .mockImplementationOnce(() => ({ roll: 5, modifier: 0, total: 5 }));
    const attackRollSpy = jest.spyOn(internals, 'rollD20').mockReturnValue(12);
    const damageSpy = jest
      .spyOn(internals, 'calculateDamage')
      .mockReturnValue(9);
    const xpSpy = jest.spyOn(internals, 'calculateXpGain').mockReturnValue(120);
    const goldSpy = jest
      .spyOn(internals, 'calculateGoldReward')
      .mockReturnValue(45);

    const result = await service.playerAttackPlayer('attacker', 'defender');

    expect(result.success).toBe(true);
    expect(result.winnerName).toBe('Attacker');
    expect(result.loserName).toBe('Defender');
    expect(result.xpGained).toBe(120);
    expect(result.goldGained).toBe(45);
    expect(result.roundsCompleted).toBe(1);
    expect(result.totalDamageDealt).toBe(9);
    expect(result.message).toBe(
      'Attacker POV summary\n\nRewards: +120 XP, +45 gold.',
    );
    expect(result.playerMessages).toHaveLength(2);
    expect(result.playerMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slackId: 'attacker',
          name: 'Attacker',
          message: 'Attacker POV summary\n\nRewards: +120 XP, +45 gold.',
        }),
        expect.objectContaining({
          slackId: 'defender',
          name: 'Defender',
          message: 'Defender POV summary\n\nRewards: +0 XP, +0 gold.',
        }),
      ]),
    );

    const [combatLog, attackerCombatant, defenderCombatant] = applyResultsSpy
      .mock.calls[0] as [DetailedCombatLog, Combatant, Combatant];

    expect(combatLog).toMatchObject({
      winner: 'Attacker',
      loser: 'Defender',
      firstAttacker: 'Attacker',
      xpAwarded: 120,
      goldAwarded: 45,
    });
    expect(combatLog.rounds).toHaveLength(1);

    const [firstRound] = combatLog.rounds;
    expect(firstRound).toMatchObject({
      attackerName: 'Attacker',
      defenderName: 'Defender',
      hit: true,
      damage: 9,
      defenderHpAfter: 0,
      killed: true,
    });

    expect(attackerCombatant.name).toBe('Attacker');
    expect(defenderCombatant.name).toBe('Defender');

    expect(playerService.getPlayer).toHaveBeenCalledTimes(2);
    expect(initiativeSpy).toHaveBeenCalledTimes(2);
    expect(attackRollSpy).toHaveBeenCalledTimes(1);
    expect(damageSpy).toHaveBeenCalledTimes(1);
    expect(xpSpy).toHaveBeenCalledWith(
      attackerPlayer.level,
      defenderPlayer.level,
    );
    expect(goldSpy).toHaveBeenCalledWith(
      attackerPlayer.level,
      defenderPlayer.level,
    );
    expect(applyResultsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ winner: 'Attacker', loser: 'Defender' }),
      expect.objectContaining({ name: 'Attacker' }),
      expect.objectContaining({ name: 'Defender' }),
    );

    const [attackerLogArg, attackerOptions] = narrativeSpy.mock.calls[0];
    const [defenderLogArg, defenderOptions] = narrativeSpy.mock.calls[1];
    const [observerLogArg, observerOptions] = narrativeSpy.mock.calls[2];

    expect(attackerLogArg).toBe(combatLog);
    expect(attackerOptions).toEqual({ secondPersonName: 'Attacker' });
    expect(defenderLogArg).toBe(combatLog);
    expect(defenderOptions).toEqual({ secondPersonName: 'Defender' });
    expect(observerLogArg).toBe(combatLog);
    expect(observerOptions).toEqual({});
  });

  it('throws when players are in different locations', async () => {
    const attackerPlayer = createPlayer({
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 10,
      level: 2,
      strength: 12,
      agility: 12,
      x: 1,
      y: 1,
    });

    const defenderPlayer = createPlayer({
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      hp: 10,
      level: 2,
      strength: 12,
      agility: 12,
      x: 2,
      y: 3,
    });

    playerService.getPlayer.mockImplementation(async (slackId: string) =>
      slackId === 'attacker' ? attackerPlayer : defenderPlayer,
    );

    await expect(
      service.playerAttackPlayer('attacker', 'defender'),
    ).rejects.toThrow('Target is not at your location');
  });

  it('throws when either combatant is dead', async () => {
    const attackerPlayer = createPlayer({
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 0,
      isAlive: false,
      x: 3,
      y: 3,
    });

    const defenderPlayer = createPlayer({
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      hp: 10,
      isAlive: true,
      x: 3,
      y: 3,
    });

    playerService.getPlayer.mockImplementation(async (slackId: string) =>
      slackId === 'attacker' ? attackerPlayer : defenderPlayer,
    );

    await expect(
      service.playerAttackPlayer('attacker', 'defender'),
    ).rejects.toThrow('One or both combatants are dead');
  });

  it('allows workspace attacks when ignoring location mismatch', async () => {
    const attackerPlayer = createPlayer({
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 14,
      maxHp: 14,
      strength: 14,
      agility: 13,
      level: 4,
      x: 1,
      y: 1,
    });

    const defenderPlayer = createPlayer({
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      hp: 12,
      maxHp: 12,
      strength: 13,
      agility: 11,
      level: 4,
      x: 10,
      y: 10,
    });

    const combatLog: DetailedCombatLog = {
      combatId: 'combat-123',
      participant1: 'Attacker',
      participant2: 'Defender',
      initiativeRolls: [],
      firstAttacker: 'Attacker',
      rounds: [
        {
          roundNumber: 1,
          attackerName: 'Attacker',
          defenderName: 'Defender',
          attackRoll: 15,
          attackModifier: 2,
          totalAttack: 17,
          defenderAC: 12,
          hit: true,
          damage: 5,
          defenderHpAfter: 7,
          killed: false,
        },
        {
          roundNumber: 2,
          attackerName: 'Defender',
          defenderName: 'Attacker',
          attackRoll: 18,
          attackModifier: 3,
          totalAttack: 21,
          defenderAC: 14,
          hit: true,
          damage: 10,
          defenderHpAfter: 0,
          killed: true,
        },
      ],
      winner: 'Defender',
      loser: 'Attacker',
      xpAwarded: 120,
      goldAwarded: 75,
      timestamp: new Date(),
      location: { x: 5, y: 5 },
    };

    playerService.getPlayer.mockImplementation(async (slackId: string) =>
      slackId === 'attacker' ? attackerPlayer : defenderPlayer,
    );

    const internals = getInternals();

    jest
      .spyOn(internals, 'playerToCombatant')
      .mockImplementation(async (slackId: string) =>
        slackId === 'attacker'
          ? {
              id: attackerPlayer.id,
              name: attackerPlayer.name,
              type: 'player',
              hp: attackerPlayer.hp,
              maxHp: attackerPlayer.maxHp,
              strength: attackerPlayer.strength,
              agility: attackerPlayer.agility,
              level: attackerPlayer.level,
              isAlive: attackerPlayer.isAlive,
              x: attackerPlayer.x,
              y: attackerPlayer.y,
              slackId: attackerPlayer.slackId,
            }
          : {
              id: defenderPlayer.id,
              name: defenderPlayer.name,
              type: 'player',
              hp: defenderPlayer.hp,
              maxHp: defenderPlayer.maxHp,
              strength: defenderPlayer.strength,
              agility: defenderPlayer.agility,
              level: defenderPlayer.level,
              isAlive: defenderPlayer.isAlive,
              x: defenderPlayer.x,
              y: defenderPlayer.y,
              slackId: defenderPlayer.slackId,
            },
      );

    const runCombatSpy = jest
      .spyOn(internals, 'runCombat')
      .mockResolvedValue(combatLog);
    const applyResultsSpy = jest
      .spyOn(internals, 'applyCombatResults')
      .mockResolvedValue({ playerRespawnEvents: [] });
    const narrativeSpy = jest
      .spyOn(internals, 'generateCombatNarrative')
      .mockImplementation(async (_combatLog, options) =>
        options?.secondPersonName === 'Attacker'
          ? 'Attacker perspective'
          : 'Defender perspective',
      );

    const result = await service.playerAttackPlayer(
      'attacker',
      'defender',
      true,
    );

    expect(result.success).toBe(true);
    expect(result.winnerName).toBe('Defender');
    expect(result.loserName).toBe('Attacker');
    expect(result.totalDamageDealt).toBe(5);
    expect(result.roundsCompleted).toBe(1);
    expect(result.xpGained).toBe(0);
    expect(result.goldGained).toBe(0);
    expect(result.message).toBe(
      'Attacker perspective\n\nRewards: +0 XP, +0 gold.',
    );
    expect(result.playerMessages).toHaveLength(2);
    expect(result.playerMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slackId: 'attacker',
          name: 'Attacker',
          message: 'Attacker perspective\n\nRewards: +0 XP, +0 gold.',
        }),
        expect.objectContaining({
          slackId: 'defender',
          name: 'Defender',
          message: 'Defender perspective\n\nRewards: +120 XP, +75 gold.',
        }),
      ]),
    );

    expect(runCombatSpy).toHaveBeenCalledTimes(1);
    expect(applyResultsSpy).toHaveBeenCalledTimes(1);
    expect(narrativeSpy.mock.calls).toHaveLength(3);
    const [attackerCall, defenderCall, observerCall] = narrativeSpy.mock.calls;
    expect(attackerCall).toEqual([combatLog, { secondPersonName: 'Attacker' }]);
    expect(defenderCall).toEqual([combatLog, { secondPersonName: 'Defender' }]);
    expect(observerCall).toEqual([combatLog, {}]);
  });

  it('applies equipment bonuses from equipped player items', async () => {
    const attackerPlayer = createPlayer({
      id: 99,
      name: 'EquippedHero',
      slackId: 'equipped',
      hp: 9,
      maxHp: 12,
      strength: 16,
      agility: 13,
      level: 5,
      x: 0,
      y: 0,
    });

    playerService.getPlayer.mockResolvedValue(attackerPlayer);

    const now = new Date();
    const weaponQuality = 'Epic' as ItemQuality;
    const armorQuality = 'Fine' as ItemQuality;

    combatPrismaHolder.current.playerItem.findMany.mockResolvedValue([
      {
        id: 1,
        playerId: attackerPlayer.id,
        itemId: 2001,
        quantity: 1,
        equipped: true,
        slot: 'weapon',
        quality: weaponQuality,
        createdAt: now,
        updatedAt: now,
        item: {
          id: 2001,
          name: 'Runeblade',
          type: 'weapon',
          description: 'A blade humming with energy.',
          value: 0,
          attack: 5,
          defense: 0,
          healthBonus: 0,
          slot: 'weapon',
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        id: 2,
        playerId: attackerPlayer.id,
        itemId: 2002,
        quantity: 1,
        equipped: true,
        slot: 'chest',
        quality: armorQuality,
        createdAt: now,
        updatedAt: now,
        item: {
          id: 2002,
          name: 'Gleaming Breastplate',
          type: 'armor',
          description: 'Polished plates that shimmer.',
          value: 0,
          attack: 0,
          defense: 3,
          healthBonus: 1,
          slot: 'chest',
          createdAt: now,
          updatedAt: now,
        },
      },
    ]);

    const internals = getInternals();
    const combatant = await internals.playerToCombatant('equipped');

    expect(combatPrismaHolder.current.playerItem.findMany).toHaveBeenCalledWith(
      {
        where: { playerId: attackerPlayer.id, equipped: true },
        include: { item: true },
      },
    );
    expect(combatant.attackBonus).toBe(4);
    expect(combatant.damageBonus).toBe(9);
    expect(combatant.armorBonus).toBe(4);
    expect(combatant.maxHp).toBe(13);
    expect(combatant.hp).toBe(10);
  });

  it('applies level ups for winning players and includes the details in messages', async () => {
    const attackerPlayer = createPlayer({
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      xp: 290,
      level: 2,
      skillPoints: 0,
      strength: 16,
      agility: 12,
      health: 12,
      hp: 8,
      maxHp: 12,
      x: 3,
      y: 3,
    });

    const defenderPlayer = createPlayer({
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      xp: 150,
      level: 2,
      hp: 0,
      maxHp: 10,
      strength: 12,
      agility: 10,
      x: 3,
      y: 3,
      isAlive: false,
    });

    playerService.getPlayer.mockImplementation(async (slackId: string) =>
      slackId === 'attacker' ? attackerPlayer : defenderPlayer,
    );

    const leveledPlayer = createPlayer({
      ...attackerPlayer,
      level: 3,
      xp: 310,
      skillPoints: 1,
      hp: 9,
      maxHp: 14,
      combat: { hp: 9, maxHp: 14, isAlive: true },
      attributes: {
        strength: attackerPlayer.attributes.strength,
        agility: attackerPlayer.attributes.agility,
        health: attackerPlayer.attributes.health,
      },
    });

    const baseUpdate = playerService.updatePlayerStats.getMockImplementation();
    playerService.updatePlayerStats.mockImplementation(
      async (slackId, stats) => {
        if (slackId === 'attacker') {
          return leveledPlayer as unknown as PlayerEntity;
        }
        return baseUpdate!(slackId, stats);
      },
    );

    const combatLog: DetailedCombatLog = {
      combatId: 'combat-789',
      participant1: 'Attacker',
      participant2: 'Defender',
      initiativeRolls: [],
      firstAttacker: 'Attacker',
      rounds: [
        {
          roundNumber: 1,
          attackerName: 'Attacker',
          defenderName: 'Defender',
          attackRoll: 18,
          attackModifier: 3,
          totalAttack: 21,
          defenderAC: 11,
          hit: true,
          damage: 7,
          defenderHpAfter: 3,
          killed: false,
        },
        {
          roundNumber: 2,
          attackerName: 'Defender',
          defenderName: 'Attacker',
          attackRoll: 12,
          attackModifier: 1,
          totalAttack: 13,
          defenderAC: 12,
          hit: true,
          damage: 3,
          defenderHpAfter: 5,
          killed: false,
        },
        {
          roundNumber: 3,
          attackerName: 'Attacker',
          defenderName: 'Defender',
          attackRoll: 19,
          attackModifier: 3,
          totalAttack: 22,
          defenderAC: 11,
          hit: true,
          damage: 6,
          defenderHpAfter: 0,
          killed: true,
        },
      ],
      winner: 'Attacker',
      loser: 'Defender',
      xpAwarded: 20,
      goldAwarded: 0,
      timestamp: new Date(),
      location: { x: 3, y: 3 },
    };

    const attackerCombatant: Combatant = {
      id: attackerPlayer.id,
      name: attackerPlayer.name,
      type: 'player',
      hp: 5,
      maxHp: attackerPlayer.maxHp,
      strength: attackerPlayer.attributes.strength,
      agility: attackerPlayer.attributes.agility,
      level: attackerPlayer.level,
      isAlive: true,
      x: attackerPlayer.x,
      y: attackerPlayer.y,
      slackId: 'attacker',
    };

    const defenderCombatant: Combatant = {
      id: defenderPlayer.id,
      name: defenderPlayer.name,
      type: 'player',
      hp: 0,
      maxHp: defenderPlayer.maxHp,
      strength: defenderPlayer.attributes.strength,
      agility: defenderPlayer.attributes.agility,
      level: defenderPlayer.level,
      isAlive: false,
      x: defenderPlayer.x,
      y: defenderPlayer.y,
      slackId: 'defender',
    };

    const internals = getInternals();

    await internals.applyCombatResults(
      combatLog,
      attackerCombatant,
      defenderCombatant,
    );

    expect(playerService.updatePlayerStats).toHaveBeenCalledWith(
      'attacker',
      expect.objectContaining({ xp: 310, hp: 5 }),
    );
    expect(attackerCombatant.level).toBe(3);
    expect(attackerCombatant.maxHp).toBe(leveledPlayer.combat.maxHp);
    expect(attackerCombatant.hp).toBe(leveledPlayer.combat.hp);
    expect(attackerCombatant.levelUp).toEqual({
      previousLevel: 2,
      newLevel: 3,
      skillPointsAwarded: 1,
    });

    jest
      .spyOn(internals, 'generateCombatNarrative')
      .mockResolvedValueOnce('Attacker POV')
      .mockResolvedValueOnce('Defender POV')
      .mockResolvedValueOnce('Observer POV');
    jest
      .spyOn(internals, 'generateEntertainingSummary')
      .mockResolvedValueOnce('Attacker summary')
      .mockResolvedValueOnce('Defender summary')
      .mockResolvedValueOnce('Observer summary');

    const { messages } = await internals.generateCombatMessages(
      combatLog,
      attackerCombatant,
      defenderCombatant,
    );
    const attackerMessage = messages.find((msg) => msg.slackId === 'attacker');
    expect(attackerMessage?.message).toContain('Rewards: +20 XP, +0 gold.');
    expect(attackerMessage?.message).toContain('Level up! Reached level 3.');
    expect(attackerMessage?.message).toContain('Awarded +1 skill point.');
  });

  it('omits defender message when slackId is missing', async () => {
    const attackerPlayer = createPlayer({
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 15,
      maxHp: 15,
      strength: 14,
      agility: 12,
      level: 5,
      x: 4,
      y: 4,
    });

    const defenderPlayer = createPlayer({
      id: 2,
      name: 'Defender',
      slackId: undefined,
      hp: 15,
      maxHp: 15,
      strength: 12,
      agility: 10,
      level: 4,
      x: 4,
      y: 4,
    });

    const combatLog: DetailedCombatLog = {
      combatId: 'combat-456',
      participant1: 'Attacker',
      participant2: 'Defender',
      initiativeRolls: [],
      firstAttacker: 'Attacker',
      rounds: [
        {
          roundNumber: 1,
          attackerName: 'Attacker',
          defenderName: 'Defender',
          attackRoll: 19,
          attackModifier: 4,
          totalAttack: 23,
          defenderAC: 11,
          hit: true,
          damage: 7,
          defenderHpAfter: 8,
          killed: false,
        },
        {
          roundNumber: 2,
          attackerName: 'Attacker',
          defenderName: 'Defender',
          attackRoll: 16,
          attackModifier: 4,
          totalAttack: 20,
          defenderAC: 11,
          hit: true,
          damage: 8,
          defenderHpAfter: 0,
          killed: true,
        },
      ],
      winner: 'Attacker',
      loser: 'Defender',
      xpAwarded: 80,
      goldAwarded: 30,
      timestamp: new Date(),
      location: { x: 4, y: 4 },
    };

    playerService.getPlayer.mockImplementation(async (slackId: string) =>
      slackId === 'attacker' ? attackerPlayer : defenderPlayer,
    );

    const internals = getInternals();

    const playerToCombatantSpy = jest
      .spyOn(internals, 'playerToCombatant')
      .mockImplementation(async (slackId: string) =>
        slackId === 'attacker'
          ? {
              id: attackerPlayer.id,
              name: attackerPlayer.name,
              type: 'player',
              hp: attackerPlayer.hp,
              maxHp: attackerPlayer.maxHp,
              strength: attackerPlayer.strength,
              agility: attackerPlayer.agility,
              level: attackerPlayer.level,
              isAlive: attackerPlayer.isAlive,
              x: attackerPlayer.x,
              y: attackerPlayer.y,
              slackId: attackerPlayer.slackId,
            }
          : {
              id: defenderPlayer.id,
              name: defenderPlayer.name,
              type: 'player',
              hp: defenderPlayer.hp,
              maxHp: defenderPlayer.maxHp,
              strength: defenderPlayer.strength,
              agility: defenderPlayer.agility,
              level: defenderPlayer.level,
              isAlive: defenderPlayer.isAlive,
              x: defenderPlayer.x,
              y: defenderPlayer.y,
              slackId: undefined,
            },
      );

    const runCombatSpy = jest
      .spyOn(internals, 'runCombat')
      .mockResolvedValue(combatLog);
    const applyResultsSpy = jest
      .spyOn(internals, 'applyCombatResults')
      .mockResolvedValue({ playerRespawnEvents: [] });
    const narrativeSpy = jest
      .spyOn(internals, 'generateCombatNarrative')
      .mockImplementation(async (_combatLog, options) =>
        options?.secondPersonName === 'Attacker'
          ? 'Attacker recap'
          : 'Defender recap',
      );

    const result = await service.playerAttackPlayer('attacker', 'defender');

    expect(result.success).toBe(true);
    expect(result.winnerName).toBe('Attacker');
    expect(result.xpGained).toBe(80);
    expect(result.goldGained).toBe(30);
    expect(result.totalDamageDealt).toBe(15);
    expect(result.roundsCompleted).toBe(1);
    expect(result.message).toBe('Attacker recap\n\nRewards: +80 XP, +30 gold.');
    expect(result.playerMessages).toHaveLength(1);
    expect(result.playerMessages[0]).toMatchObject({
      slackId: 'attacker',
      name: 'Attacker',
      message: 'Attacker recap\n\nRewards: +80 XP, +30 gold.',
    });

    expect(playerToCombatantSpy).toHaveBeenCalledTimes(2);
    expect(runCombatSpy).toHaveBeenCalledTimes(1);
    expect(applyResultsSpy).toHaveBeenCalledTimes(1);
    expect(narrativeSpy.mock.calls).toHaveLength(2);
    const [attackerCall, observerCall] = narrativeSpy.mock.calls;
    expect(attackerCall).toEqual([combatLog, { secondPersonName: 'Attacker' }]);
    expect(observerCall).toEqual([combatLog, {}]);
  });

  it('prevents player vs monster combat when they are apart', async () => {
    const internals = getInternals();

    const heroCombatant: Combatant = {
      id: 1,
      name: 'Hero',
      type: 'player',
      hp: 20,
      maxHp: 20,
      strength: 12,
      agility: 12,
      level: 3,
      isAlive: true,
      x: 1,
      y: 1,
      slackId: 'hero',
    };

    const goblinCombatant: Combatant = {
      id: 99,
      name: 'Goblin',
      type: 'monster',
      hp: 8,
      maxHp: 8,
      strength: 10,
      agility: 10,
      level: 1,
      isAlive: true,
      x: 2,
      y: 3,
    };

    jest.spyOn(internals, 'playerToCombatant').mockResolvedValue(heroCombatant);

    jest
      .spyOn(internals, 'monsterToCombatant')
      .mockResolvedValue(goblinCombatant);

    await expect(service.playerAttackMonster('hero', 99)).rejects.toThrow(
      'Target is not at your location',
    );
  });

  it('processes combat:initiate events emitted on the EventBus', async () => {
    EventBus.clear();

    const initiateSpy = jest
      .spyOn(service, 'initiateCombat')
      .mockResolvedValue({
        success: true,
        winnerName: 'Attacker',
        loserName: 'Defender',
        totalDamageDealt: 0,
        roundsCompleted: 0,
        xpGained: 0,
        goldGained: 0,
        message: '',
        playerMessages: [],
      } as CombatResult);

    service.onModuleInit();

    const combatEvent: CombatInitiateEvent = {
      eventType: 'combat:initiate',
      attacker: { type: 'monster', id: 42, name: 'Goblin' },
      defender: { type: 'player', id: 'player-1', name: 'Hero' },
      metadata: { ignoreLocation: true, source: 'spec', reason: 'unit-test' },
      timestamp: new Date(),
    };

    // Ensure the service registered a handler on EventBus and invoke it
    // directly from the mock's recorded calls to deterministically test
    // the wiring (this avoids relying on emit semantics which can vary
    // between test environments).
    const onMock = (EventBus as any).on as jest.Mock;
    expect(onMock).toHaveBeenCalled();
    const registeredHandler = onMock.mock.calls[0][1] as (
      ev: unknown,
    ) => Promise<void> | void;
    await registeredHandler(combatEvent);

    expect(initiateSpy).toHaveBeenCalledWith(
      42,
      'monster',
      'player-1',
      'player',
      { ignoreLocation: true },
    );

    service.onModuleDestroy();
    EventBus.clear();
  });
});
