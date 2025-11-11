import { PlayerService } from './player.service';
import type { Player } from '@mud/database';
import { EventBus } from '../../shared/event-bus';

const mockPrisma = {
  player: {
    count: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
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

const createPlayerItemService = () => ({
  getEquipmentTotals: jest.fn().mockResolvedValue({
    attackBonus: 0,
    damageBonus: 0,
    armorBonus: 0,
    vitalityBonus: 0,
  }),
});

describe('PlayerService', () => {
  let service: PlayerService;
  let worldService: ReturnType<typeof createWorldService>;
  let playerItemService: ReturnType<typeof createPlayerItemService>;
  let eventBusEmitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.clearAllMocks();
    diceQueue = [];
    worldService = createWorldService();
    playerItemService = createPlayerItemService();
    service = new PlayerService(worldService as never, playerItemService as never);
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
      const startingHealth = 13;
      const basePlayer = makePlayer({
        skillPoints: 2,
        strength: 15,
        health: startingHealth,
        maxHp: service.getMaxHpFor(startingHealth, 1),
        hp: service.getMaxHpFor(startingHealth, 1),
      });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(basePlayer);

      const updated = await service.spendSkillPoint('T1', 'U1', 'health');
      expect(updated.health).toBe(startingHealth + 1);
      const expectedMax = service.getMaxHpFor(startingHealth + 1, 1);
      expect(updated.maxHp).toBe(expectedMax);
      expect(updated.hp).toBe(expectedMax);
      expect(updated.skillPoints).toBe(1);
      expect(playerItemService.getEquipmentTotals).toHaveBeenCalledWith(
        basePlayer.id,
      );
      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            health: startingHealth + 1,
            maxHp: expectedMax,
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

    it('calculates deterministic level-up HP gain with minimum of 1', () => {
      const lowGain = (service as any).calculateLevelUpHpGain(6); // modifier -2
      expect(lowGain).toBe(4);
      const highGain = (service as any).calculateLevelUpHpGain(18); // modifier +4
      expect(highGain).toBe(10);
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

  describe('updatePlayerStats', () => {
    it('levels up when XP crosses threshold and emits event', async () => {
      const health = 12;
      const basePlayer = makePlayer({
        xp: 90,
        level: 1,
        skillPoints: 0,
        health,
        hp: service.getMaxHpFor(health, 1),
        maxHp: service.getMaxHpFor(health, 1),
      });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(basePlayer);
      mockPrisma.player.update.mockResolvedValue(undefined);
      mockPrisma.player.findUnique.mockResolvedValue({
        ...basePlayer,
        level: 2,
      });

      const updated = await service.updatePlayerStats('T1', 'U1', { xp: 150 });

      expect(updated.level).toBe(2);
      expect(updated.maxHp).toBe(service.getMaxHpFor(health, 2));
      expect(playerItemService.getEquipmentTotals).toHaveBeenCalledWith(
        basePlayer.id,
      );
      expect(eventBusEmitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'player:levelup',
          newLevel: 2,
        }),
      );
    });
  });

  describe('rerollPlayerStats', () => {
    it('regenerates stats when creation not complete', async () => {
      const initial = makePlayer({ isCreationComplete: false });
      const rerolled = makePlayer({
        id: initial.id,
        strength: 18,
        agility: 16,
        health: 15,
        maxHp: 12,
      });
      const getPlayerSpy = jest
        .spyOn(service, 'getPlayer')
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(rerolled);
      diceQueue = [18, 16, 15];
      mockPrisma.player.update.mockResolvedValue(undefined);

      const result = await service.rerollPlayerStats('T1', 'U1');

      expect(getPlayerSpy).toHaveBeenCalledTimes(2);
      expect(result.strength).toBe(18);
      expect(result.maxHp).toBe(service.getMaxHpFor(15, result.level));
      expect(playerItemService.getEquipmentTotals).toHaveBeenCalledWith(
        initial.id,
      );
    });

    it('throws when creation already complete', async () => {
      const current = makePlayer({ isCreationComplete: true });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(current);
      await expect(service.rerollPlayerStats('T1', 'U1')).rejects.toThrow(
        'Character creation is complete. You cannot reroll anymore.',
      );
    });
  });

  describe('recalculatePlayerHitPointsFromEquipment', () => {
    it('adjusts maxHp based on vitality bonuses from gear', async () => {
      const basePlayer = makePlayer({ health: 14, level: 5 });
      basePlayer.maxHp = service.getMaxHpFor(basePlayer.health, basePlayer.level);
      basePlayer.hp = basePlayer.maxHp;
      mockPrisma.player.findUnique.mockResolvedValueOnce({ ...basePlayer });
      playerItemService.getEquipmentTotals.mockResolvedValueOnce({
        attackBonus: 0,
        damageBonus: 0,
        armorBonus: 0,
        vitalityBonus: 4,
      });
      mockPrisma.player.update.mockResolvedValue(undefined);

      const updated = await service.recalculatePlayerHitPointsFromEquipment(
        basePlayer.id,
      );

      const expectedMax = service.getMaxHpFor(
        basePlayer.health + 4,
        basePlayer.level,
      );
      expect(updated?.maxHp).toBe(expectedMax);
      expect(mockPrisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ maxHp: expectedMax }),
        }),
      );
    });
  });

  describe('health adjustments', () => {
    it('caps healing at max HP', async () => {
      const player = makePlayer({ hp: 5, maxHp: 10 });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(player);
      mockPrisma.player.update.mockResolvedValue(undefined);

      const healed = await service.healPlayer('T1', 'U1', 10);
      expect(healed.hp).toBe(10);
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: player.id },
        data: { hp: 10 },
      });
    });

    it('emits player:death when damage kills an alive player', async () => {
      const player = makePlayer({ hp: 5, isAlive: true });
      jest.spyOn(service, 'getPlayer').mockResolvedValue(player);
      mockPrisma.player.update.mockResolvedValue(undefined);
      mockPrisma.player.findUnique.mockResolvedValue({
        ...player,
        hp: -5,
        isAlive: false,
      });

      await service.damagePlayer('T1', 'U1', 10);

      expect(eventBusEmitSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'player:death',
          player: expect.objectContaining({ id: player.id }),
        }),
      );
    });
  });

  describe('updateLastAction', () => {
    it('writes timestamp on player row', async () => {
      mockPrisma.player.update.mockResolvedValue(undefined);
      await service.updateLastAction(123);
      expect(mockPrisma.player.update).toHaveBeenCalledWith({
        where: { id: 123 },
        data: { lastAction: expect.any(Date) },
      });
    });
  });

  describe('spawn helpers', () => {
    it('returns preferred spawn when no existing players', async () => {
      mockPrisma.player.findMany.mockResolvedValueOnce([]);
      const pos = await (service as any).findValidSpawnPosition(5, 6);
      expect(pos).toEqual({ x: 5, y: 6 });
    });

    it('falls back to nearest non-water when attempts fail', async () => {
      mockPrisma.player.findMany.mockResolvedValueOnce([
        { x: 0, y: 0, isAlive: true },
      ]);
      worldService.getTileInfo.mockRejectedValue(new Error('boom'));
      jest
        .spyOn(service as any, 'findNearestNonWater')
        .mockResolvedValueOnce({ x: 9, y: 9 });

      const pos = await (service as any).findValidSpawnPosition();
      expect(pos).toEqual({ x: 9, y: 9 });
    });

    it('finds nearest non-water tile by scanning rings', async () => {
      worldService.getTileInfo
        .mockRejectedValueOnce(new Error('water'))
        .mockResolvedValueOnce({ biomeName: 'forest' });

      const result = await (service as any).findNearestNonWater(0, 0, 1);
      expect(result).toEqual({ x: -1, y: -1 });
    });
  });
});
