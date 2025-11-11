import { PlayerService } from './player.service';
import type { Player } from '@mud/database';
import { EventBus } from '../../shared/event-bus';

const mockPrisma = {
  player: {
    count: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
};

const mockFindPlayerBySlackUser = jest.fn();

jest.mock('@mud/database', () => {
  const actual = jest.requireActual('@mud/database');
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
    findPlayerBySlackUser: (...args: unknown[]) =>
      mockFindPlayerBySlackUser(...args),
  };
});

let diceQueue: number[] = [];

jest.mock('@dice-roller/rpg-dice-roller', () => ({
  DiceRoll: jest.fn().mockImplementation(() => ({
    total: diceQueue.length > 0 ? (diceQueue.shift() as number) : 12,
  })),
}));

const createWorldService = () => ({
  getTileInfo: jest.fn().mockResolvedValue({ biomeName: 'grassland' }),
  getTileInfoWithNearby: jest.fn(),
  getTilesInBounds: jest.fn(),
  getBoundsTiles: jest.fn(),
});

describe('PlayerService', () => {
  let service: PlayerService;
  let worldService: ReturnType<typeof createWorldService>;
  let eventBusEmitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.clearAllMocks();
    diceQueue = [];
    worldService = createWorldService();
    service = new PlayerService(worldService as never);
    eventBusEmitSpy = jest
      .spyOn(EventBus, 'emit')
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const makePlayer = (overrides: Partial<Player> = {}): Player =>
    ({
      id: 1,
      name: 'Hero',
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      agility: 2,
      strength: 10,
      health: 10,
      level: 1,
      xp: 0,
      gold: 0,
      skillPoints: 0,
      isAlive: true,
      isCreationComplete: false,
      lastAction: null,
      ...overrides,
    }) as Player;

  describe('hasActivePlayers', () => {
    it('returns true when player count exceeds zero', async () => {
      mockPrisma.player.count.mockResolvedValue(2);
      const result = await service.hasActivePlayers(15);
      expect(result).toBe(true);
      expect(mockPrisma.player.count).toHaveBeenCalledWith({
        where: {
          lastAction: {
            gte: new Date(Date.now() - 15 * 60 * 1000),
          },
        },
      });
    });
  });

  describe('movePlayer', () => {
    it('throws when requested distance exceeds agility', async () => {
      jest
        .spyOn(service, 'getPlayer')
        .mockResolvedValue(makePlayer({ agility: 1 }));

      await expect(
        service.movePlayer('T1', 'U1', { direction: 'north', distance: 3 }),
      ).rejects.toThrow('You can move up to 1 space based on your agility.');
    });

    it('updates coordinates and emits move event', async () => {
      const basePlayer = makePlayer({ agility: 3 });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(basePlayer);
      mockPrisma.player.update.mockResolvedValue(undefined);
      mockPrisma.player.findUnique.mockResolvedValue(
        makePlayer({ id: 1, x: 0, y: 2 }),
      );

      const result = await service.movePlayer('T1', 'U1', {
        direction: 'north',
        distance: 2,
      });

      expect(worldService.getTileInfo).toHaveBeenCalledWith(0, 2);
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { x: 0, y: 2 },
      });
      expect(eventBusEmitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'player:move',
          toY: 2,
        }),
      );
      expect(result.y).toBe(2);
    });
  });

  describe('spendSkillPoint', () => {
    it('increments attribute and consumes skill points', async () => {
      const basePlayer = makePlayer({
        skillPoints: 2,
        strength: 15,
        health: 14,
      });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(basePlayer);
      jest
        .spyOn(service as unknown as { calculateLevelUpHpGain: () => number }, 'calculateLevelUpHpGain')
        .mockReturnValue(3);

      const updated = await service.spendSkillPoint('T1', 'U1', 'health');
      expect(updated.health).toBe(15);
      expect(updated.maxHp).toBe(13);
      expect(updated.skillPoints).toBe(1);
      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            health: 15,
            maxHp: 13,
            skillPoints: 1,
          }),
        }),
      );
    });
  });

  describe('random stat helpers', () => {
    it('applies deterministic dice totals for generateRandomStats', () => {
      diceQueue = [15, 14, 13];
      const stats = (service as any).generateRandomStats();
      expect(stats).toEqual({
        strength: 15,
        agility: 14,
        health: 13,
        maxHp: 11, // 10 + modifier of +1
      });
    });

    it('calculates level-up HP gain with minimum of 1', () => {
      diceQueue = [1]; // mocked DiceRoll total
      const gain = (service as any).calculateLevelUpHpGain(8);
      expect(gain).toBeGreaterThanOrEqual(1);
    });
  });

  describe('utility math', () => {
    it('computes XP threshold increases with level', () => {
      const xp2 = (service as any).getXpForNextLevel(2);
      const xp3 = (service as any).getXpForNextLevel(3);
      expect(xp3).toBeGreaterThan(xp2);
    });

    it('calculates Euclidean distance', () => {
      const d = service.calculateDistance(0, 0, 3, 4);
      expect(d).toBe(5);
    });
  });
});
