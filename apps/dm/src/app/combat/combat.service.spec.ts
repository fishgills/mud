import { CombatService, Combatant } from './combat.service';
import type { PlayerEntity } from '@mud/engine';
import type { EventBridgeService } from '../../shared/event-bridge.service';
import type { PlayerService } from '../player/player.service';
import type { AiService } from '../../openai/ai.service';
import type { CombatResult, DetailedCombatLog } from '../graphql';

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
};

const createMockPrisma = (): MockPrismaClient => ({
  combatLog: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  monster: {
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
});

var mockPrisma: MockPrismaClient;

jest.mock('@mud/database', () => ({
  getPrismaClient: () => mockPrisma,
}));

mockPrisma = createMockPrisma();

const accessPrivate = <T>(instance: object, key: string): T =>
  (instance as Record<string, unknown>)[key] as T;

const createHelperService = () => {
  const playerService = {
    getPlayer: jest.fn(),
    updatePlayerStats: jest.fn(),
    respawnPlayer: jest.fn(),
  } as unknown as PlayerService;

  const aiService = {
    getText: jest.fn(),
  } as unknown as AiService;

  const eventBridge = {
    publishCombatNotifications: jest.fn().mockResolvedValue(undefined),
  } as unknown as EventBridgeService;

  const service = new CombatService(
    playerService,
    aiService,
    eventBridge,
  );
  return {
    service,
    aiService: aiService as unknown as { getText: jest.Mock },
    eventBridge: eventBridge as unknown as { publishCombatNotifications: jest.Mock },
  };
};

describe('CombatService helpers', () => {
  beforeEach(() => {
    mockPrisma = createMockPrisma();
    jest.clearAllMocks();
  });

  it('describes combat rounds from the second-person perspective', () => {
    const { service } = createHelperService();
    const describeRound = accessPrivate<
      (
        round: {
          roundNumber: number;
          attackerName: string;
          defenderName: string;
          hit: boolean;
          damage: number;
          killed: boolean;
        },
        options?: { secondPersonName?: string },
      ) => string
    >(service, 'describeRound').bind(service);

    const hitRound = {
      roundNumber: 1,
      attackerName: 'Hero',
      defenderName: 'Goblin',
      hit: true,
      damage: 6,
      killed: false,
    };

    expect(describeRound(hitRound, { secondPersonName: 'Hero' })).toContain(
      'You strike Goblin',
    );
    expect(describeRound(hitRound)).toContain('Hero hits Goblin');
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
  });

  it('returns combat logs for a location via the prisma client', async () => {
    const { service } = createHelperService();
    const expected = [{ id: 1 }];
    mockPrisma.combatLog.findMany.mockResolvedValue(expected);

    await expect(service.getCombatLogForLocation(3, 4, 2)).resolves.toBe(
      expected,
    );

    expect(mockPrisma.combatLog.findMany).toHaveBeenCalledWith({
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
    strength:
      overrides.attributes?.strength ?? overrides.strength ?? 10,
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
      overrides.clientId ??
      (overrides.slackId ? `slack:${overrides.slackId}` : 'slack:player'),
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
  'getPlayer' | 'updatePlayerStats' | 'respawnPlayer' | 'getPlayersAtLocation'
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
      updatePlayerStats: jest.fn(),
      respawnPlayer: jest.fn(),
      getPlayersAtLocation: jest.fn().mockResolvedValue([]),
    } as jest.Mocked<MockPlayerService>;

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
      .mockResolvedValue(undefined);
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
    expect(result.message).toBe('Attacker POV summary');
    expect(result.playerMessages).toHaveLength(2);
    expect(result.playerMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slackId: 'attacker',
          name: 'Attacker',
          message: 'Attacker POV summary',
        }),
        expect.objectContaining({
          slackId: 'defender',
          name: 'Defender',
          message: 'Defender POV summary',
        }),
      ]),
    );

    const [combatLog, attackerCombatant, defenderCombatant] =
      applyResultsSpy.mock.calls[0] as [
        DetailedCombatLog,
        Combatant,
        Combatant,
      ];

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
      defenderPlayer.level,
      attackerPlayer.level,
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
      .mockResolvedValue(undefined);
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
    expect(result.message).toBe('Attacker perspective');
    expect(result.playerMessages).toHaveLength(2);
    expect(result.playerMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slackId: 'attacker',
          name: 'Attacker',
          message: 'Attacker perspective',
        }),
        expect.objectContaining({
          slackId: 'defender',
          name: 'Defender',
          message: 'Defender perspective',
        }),
      ]),
    );

    expect(runCombatSpy).toHaveBeenCalledTimes(1);
    expect(applyResultsSpy).toHaveBeenCalledTimes(1);
    expect(narrativeSpy.mock.calls).toHaveLength(3);
    const [attackerCall, defenderCall, observerCall] = narrativeSpy.mock.calls;
    expect(attackerCall).toEqual([
      combatLog,
      { secondPersonName: 'Attacker' },
    ]);
    expect(defenderCall).toEqual([
      combatLog,
      { secondPersonName: 'Defender' },
    ]);
    expect(observerCall).toEqual([combatLog, {}]);
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
      .mockResolvedValue(undefined);
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
    expect(result.message).toBe('Attacker recap');
    expect(result.playerMessages).toHaveLength(1);
    expect(result.playerMessages[0]).toMatchObject({
      slackId: 'attacker',
      name: 'Attacker',
      message: 'Attacker recap',
    });

    expect(playerToCombatantSpy).toHaveBeenCalledTimes(2);
    expect(runCombatSpy).toHaveBeenCalledTimes(1);
    expect(applyResultsSpy).toHaveBeenCalledTimes(1);
    expect(narrativeSpy.mock.calls).toHaveLength(2);
    const [attackerCall, observerCall] = narrativeSpy.mock.calls;
    expect(attackerCall).toEqual([
      combatLog,
      { secondPersonName: 'Attacker' },
    ]);
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
});
