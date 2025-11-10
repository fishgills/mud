import { CombatService } from './combat.service';
import type { PlayerService } from '../player/player.service';
import type { AiService } from '../../openai/ai.service';
import type { EventBridgeService } from '../../shared/event-bridge.service';
import type { Combatant, CombatMessage } from './combat.service';
import type { DetailedCombatLog } from '../api';
import { AttackOrigin } from '../api/dto/player-requests.dto';

const mockApplyCombatResults = jest.fn().mockResolvedValue({
  playerRespawnEvents: [],
});

jest.mock('./results', () => ({
  applyCombatResults: (...args: unknown[]) =>
    mockApplyCombatResults(...(args as [unknown])),
}));

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    emit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnValue(() => undefined),
  },
}));

const makeIdentity = (label: string) => ({
  teamId: `T-${label}`,
  userId: label,
});

const makeCombatant = (overrides: Partial<Combatant> = {}): Combatant => ({
  id: overrides.id ?? 1,
  name: overrides.name ?? 'Hero',
  type: overrides.type ?? 'player',
  hp: overrides.hp ?? 10,
  maxHp: overrides.maxHp ?? 10,
  strength: overrides.strength ?? 10,
  agility: overrides.agility ?? 10,
  level: overrides.level ?? 1,
  isAlive: overrides.isAlive ?? true,
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  slackUser:
    overrides.slackUser ??
    (overrides.type === 'player'
      ? { teamId: `T-${overrides.name ?? 'Hero'}`, userId: overrides.name ?? 'Hero' }
      : undefined),
  ...overrides,
});

describe('CombatService (refactored wrappers)', () => {
  const playerService = {
    getPlayer: jest.fn(),
    getPlayersAtLocation: jest.fn(),
    respawnPlayer: jest.fn(),
    restorePlayerHealth: jest.fn(),
    updatePlayerStats: jest.fn(),
  } as unknown as PlayerService;

  const aiService = {
    getText: jest.fn(),
  } as unknown as AiService;

  const eventBridge = {
    publishCombatNotifications: jest.fn().mockResolvedValue(undefined),
  } as unknown as EventBridgeService;

  let service: CombatService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CombatService(playerService, aiService, eventBridge);
  });

  it('blocks combat when players are in different locations', async () => {
    const attacker = makeCombatant({ name: 'Attacker', x: 0, y: 0 });
    const defender = makeCombatant({ name: 'Defender', id: 2, x: 10, y: -3 });

    (service as any).playerToCombatant = jest
      .fn()
      .mockResolvedValueOnce(attacker)
      .mockResolvedValueOnce(defender);

    await expect(
      service.initiateCombat(
        makeIdentity('A'),
        'player',
        makeIdentity('B'),
        'player',
      ),
    ).rejects.toThrow('Target is not at your location');
  });

  it('runs combat, applies results, and publishes notifications', async () => {
    const attacker = makeCombatant({
      name: 'Attacker',
      slackUser: { teamId: 'T-A', userId: 'A' },
    });
    const defender = makeCombatant({
      id: 2,
      name: 'Defender',
      slackUser: { teamId: 'T-B', userId: 'B' },
    });
    const combatLog: DetailedCombatLog = {
      combatId: 'c-123',
      participant1: 'Attacker',
      participant2: 'Defender',
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
          defenderHpAfter: 5,
          killed: false,
        },
      ],
      winner: 'Attacker',
      loser: 'Defender',
      xpAwarded: 20,
      goldAwarded: 4,
      timestamp: new Date(),
      location: { x: 0, y: 0 },
      initiativeRolls: [],
    };
    const mockMessages: CombatMessage[] = [
      {
        teamId: 'T-A',
        userId: 'A',
        name: 'Attacker',
        role: 'attacker',
        message: 'Attacker wins!',
      },
    ];

    (service as any).playerToCombatant = jest
      .fn()
      .mockResolvedValueOnce(attacker)
      .mockResolvedValueOnce(defender);
    (service as any).runCombat = jest.fn().mockResolvedValue(combatLog);
    (service as any).applyCombatResults = jest
      .fn()
      .mockResolvedValue({ playerRespawnEvents: [] });
    (service as any).generateCombatMessages = jest
      .fn()
      .mockResolvedValue({ messages: mockMessages, perf: { totalMs: 5 } });
    (service as any).dispatchRespawnEvents = jest
      .fn()
      .mockResolvedValue(undefined);

    const result = await service.playerAttackPlayer(
      makeIdentity('A'),
      makeIdentity('B'),
      true,
      { attackOrigin: AttackOrigin.TEXT_PVP },
    );

    expect(result.success).toBe(true);
    expect(result.winnerName).toBe('Attacker');
    expect(result.totalDamageDealt).toBe(5);
    expect(result.playerMessages).toEqual(mockMessages);
    expect(eventBridge.publishCombatNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'combat:end',
        winner: expect.objectContaining({ name: 'Attacker' }),
      }),
      mockMessages,
    );
    expect((service as any).runCombat).toHaveBeenCalled();
    expect(mockApplyCombatResults).toHaveBeenCalledWith(
      combatLog,
      attacker,
      defender,
      playerService,
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({ attackOrigin: AttackOrigin.TEXT_PVP }),
    );
  });

  it('rejects when either combatant is dead', async () => {
    const attacker = makeCombatant({ isAlive: false });
    const defender = makeCombatant({ id: 2 });
    (service as any).playerToCombatant = jest
      .fn()
      .mockResolvedValueOnce(attacker)
      .mockResolvedValueOnce(defender);

    await expect(
      service.initiateCombat(
        makeIdentity('A'),
        'player',
        makeIdentity('B'),
        'player',
      ),
    ).rejects.toThrow('One or both combatants are dead');
  });
});
