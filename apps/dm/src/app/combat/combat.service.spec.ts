import { CombatService } from './combat.service';
import { AttackOrigin } from '../api/dto/player-requests.dto';
import { calculateEquipmentEffects } from '../player/equipment.effects';

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    emit: jest.fn().mockResolvedValue(undefined),
  },
}));

const createPlayerService = () => ({
  getPlayer: jest.fn(),
  getPlayersAtLocation: jest.fn(),
  movePlayer: jest.fn(),
});

const createAiService = () => ({
  summarizeCombat: jest.fn(),
});

const createEventBridge = () => ({
  publishCombatNotifications: jest.fn(),
});

const mockPrisma = {
  combatLog: { create: jest.fn(), findMany: jest.fn() },
  monster: { create: jest.fn() },
  player: { findUnique: jest.fn() },
};

jest.mock('@mud/database', () => {
  const actual = jest.requireActual('@mud/database');
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
  };
});

jest.mock('./engine', () => {
  const actual = jest.requireActual('./engine');
  return {
    ...actual,
    runCombat: jest.fn(),
  };
});

jest.mock('./messages', () => ({
  CombatMessenger: jest.fn().mockImplementation(() => ({
    sendCombatMessages: jest.fn(),
  })),
}));

jest.mock('./results', () => ({
  applyCombatResults: jest.fn().mockResolvedValue({
    playerRespawnEvents: [],
  }),
}));

describe('CombatService', () => {
  let service: CombatService;
  let playerService: ReturnType<typeof createPlayerService>;
  let aiService: ReturnType<typeof createAiService>;
  let eventBridge: ReturnType<typeof createEventBridge>;
  const { EventBus } = jest.requireMock('../../shared/event-bus') as {
    EventBus: { emit: jest.Mock };
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    playerService = createPlayerService();
    aiService = createAiService();
    eventBridge = createEventBridge();
    service = new CombatService(
      playerService as never,
      aiService as never,
      eventBridge as never,
    );
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    jest
      .spyOn(Math, 'floor')
      .mockImplementation((n) => Number.parseInt(String(n), 10));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
    EventBus.emit.mockClear();
  });

  const buildCombatant = (
    overrides: Partial<Record<string, unknown>> = {},
  ) => ({
    id: 1,
    name: 'Hero',
    type: 'player',
    hp: 10,
    maxHp: 10,
    strength: 12,
    agility: 12,
    level: 3,
    isAlive: true,
    x: 0,
    y: 0,
    slackUser: { teamId: 'T1', userId: 'U1' },
    ...overrides,
  });

  describe('playerAttackPlayer', () => {
    it('invokes initiateCombat for player vs player attacks', async () => {
      const mockResult = { winner: 'Hero' };
      const serviceWithInitiate = service as unknown as {
        initiateCombat: jest.Mock;
      };
      jest
        .spyOn(serviceWithInitiate, 'initiateCombat')
        .mockResolvedValue(mockResult);

      const response = await service.playerAttackPlayer(
        { teamId: 'T1', userId: 'U1' },
        { teamId: 'T2', userId: 'U2' },
        true,
        { attackOrigin: AttackOrigin.DROPDOWN_PVP },
      );

      expect(response).toBe(mockResult);
      expect(serviceWithInitiate.initiateCombat).toHaveBeenCalledWith(
        { teamId: 'T1', userId: 'U1' },
        'player',
        { teamId: 'T2', userId: 'U2' },
        'player',
        expect.objectContaining({
          ignoreLocation: true,
          attackOrigin: AttackOrigin.DROPDOWN_PVP,
        }),
      );
    });
  });

  describe('XP and gold calculations', () => {
    it('awards more XP for defeating higher-level foes', () => {
      const xpVsHigher = (service as any).calculateXpGain(5, 8);
      const xpVsLower = (service as any).calculateXpGain(8, 5);
      expect(xpVsHigher).toBeGreaterThan(xpVsLower);
    });

    it('ensures minimum gold reward and scales with level difference', () => {
      const goldEqual = (service as any).calculateGoldReward(5, 5);
      const goldHigherTarget = (service as any).calculateGoldReward(5, 8);
      expect(goldEqual).toBeGreaterThanOrEqual(5);
      expect(goldHigherTarget).toBeGreaterThanOrEqual(goldEqual);
    });
  });

  describe('equipment effects', () => {
    it('derives bonuses from equipped items with quality multipliers', () => {
      const weapon = {
        id: 1,
        playerId: 10,
        slot: 'weapon',
        quality: 'Rare',
        item: {
          id: 100,
          name: 'Sword',
          damageRoll: '1d8',
          defense: 0,
          slot: 'weapon',
          type: 'weapon',
        },
      };
      const armor = {
        id: 2,
        playerId: 10,
        slot: 'chest',
        quality: 'Common',
        item: {
          id: 101,
          name: 'Armor',
          damageRoll: '1d4',
          defense: 3,
          slot: 'chest',
        },
      };

      const result = calculateEquipmentEffects([weapon as any, armor as any]);
      expect(result.totals.weaponDamageRoll).toBe('1d8');
      expect(result.totals.armorBonus).toBeGreaterThan(0);
      expect(result.totals.vitalityBonus).toBe(0);
    });
  });

  describe('fallback narrative', () => {
    it('builds a readable narrative when AI summary is unavailable', () => {
      const attacker = buildCombatant({ name: 'Hero' });
      const defender = buildCombatant({
        name: 'Goblin',
        id: 2,
        type: 'monster',
      });
      const combatLog = {
        combatId: 'c1',
        winner: 'Hero',
        loser: 'Goblin',
        rounds: [
          {
            attackerName: 'Hero',
            defenderName: 'Goblin',
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
      } as any;

      const narrative = (service as any).createFallbackNarrative(combatLog, {
        attackerCombatant: attacker,
        defenderCombatant: defender,
      });

      expect(narrative.metrics).toContain('Hero');
      expect(narrative.rounds[0]).toContain('HIT');
    });
  });

  describe('player activity tracking', () => {
    it('emits player activity events for combatants', async () => {
      const combatant = buildCombatant({ id: 42 });
      await (service as any).emitPlayerActivityEvent(combatant, 'combat:test', {
        targetType: 'monster',
      });

      expect(EventBus.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'player:activity',
          playerId: 42,
          source: 'combat:test',
          metadata: { targetType: 'monster' },
        }),
      );
    });

    it('skips activity emission for non-player combatants', async () => {
      const monster = buildCombatant({ type: 'monster', id: 7 });
      await (service as any).emitPlayerActivityEvent(monster, 'combat:test');
      expect(EventBus.emit).not.toHaveBeenCalled();
    });
  });
});
