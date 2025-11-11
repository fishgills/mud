import { MovementController } from './movement.controller';
import { BadRequestException } from '@nestjs/common';

const createPlayerService = () => ({
  getPlayer: jest.fn(),
  movePlayer: jest.fn(),
  getPlayersAtLocation: jest.fn(),
  updateLastAction: jest.fn().mockResolvedValue(undefined),
});

const createWorldService = () => ({
  getTileInfoWithNearby: jest.fn(),
  findNearestSettlement: jest.fn().mockResolvedValue(null),
  getTilesInBounds: jest.fn(),
  getBoundsTiles: jest.fn(),
});

const createMonsterService = () => ({
  findNearestMonsterWithinRadius: jest.fn(),
  getMonstersAtLocation: jest.fn(),
});

const noopService = () => ({});

describe('MovementController', () => {
  let controller: MovementController;
  let playerService: ReturnType<typeof createPlayerService>;
  let worldService: ReturnType<typeof createWorldService>;
  let monsterService: ReturnType<typeof createMonsterService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    playerService = createPlayerService();
    worldService = createWorldService();
    monsterService = createMonsterService();
    controller = new MovementController(
      playerService as never,
      worldService as never,
      noopService() as never,
      noopService() as never,
      noopService() as never,
      noopService() as never,
      noopService() as never,
      noopService() as never,
      monsterService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  describe('sniffNearestMonster', () => {
    it('returns settlement messaging when no monsters detected', async () => {
      const player = { id: 1, x: 0, y: 0, agility: 2 };
      playerService.getPlayer.mockResolvedValue(player);
      worldService.getTileInfoWithNearby.mockResolvedValue({
        nearbySettlements: [],
        currentSettlement: {
          name: 'Town',
          x: 0,
          y: 0,
        },
      });
      monsterService.findNearestMonsterWithinRadius.mockResolvedValue(null);

      const response = await controller.sniffNearestMonster('T1', 'U1');

      expect(response.success).toBe(true);
      expect(response.message).toContain("can't catch any monster scent");
      expect(response.data?.detectionRadius).toBe(2);
      expect(playerService.updateLastAction).toHaveBeenCalledWith(1);
    });

    it('describes nearest monster and settlement sentence', async () => {
      const player = { id: 1, x: 0, y: 0, agility: 3 };
      playerService.getPlayer.mockResolvedValue(player);
      worldService.getTileInfoWithNearby.mockResolvedValue({
        nearbySettlements: [
          { name: 'Village', x: 3, y: 0, description: 'test' },
        ],
        currentSettlement: null,
      });
      monsterService.findNearestMonsterWithinRadius.mockResolvedValue({
        monster: { name: 'Goblin', x: 1, y: 0 },
        distance: 1,
      });

      const response = await controller.sniffNearestMonster('T1', 'U1');

      expect(response.success).toBe(true);
      expect(response.message).toContain('Goblin');
      expect(response.data?.direction).toBe('east');
      expect(response.data?.nearestSettlementName).toBe('Village');
    });

    it('handles service errors gracefully', async () => {
      playerService.getPlayer.mockRejectedValue(new Error('nope'));

      const response = await controller.sniffNearestMonster('T1', 'U1');
      expect(response.success).toBe(false);
      expect(response.message).toBe('nope');
    });
  });

  describe('movePlayer', () => {
    it('throws when identity missing', async () => {
      await expect(
        controller.movePlayer({
          userId: '',
          teamId: '',
          move: { direction: 'north' } as never,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns success response with nearby entities', async () => {
      const player = { id: 1, name: 'Hero', x: 5, y: 5 };
      playerService.movePlayer.mockResolvedValue(player);
      monsterService.getMonstersAtLocation.mockResolvedValue([
        { id: 10, name: 'Goblin' },
      ]);
      playerService.getPlayersAtLocation.mockResolvedValue([{ id: 2 }]);
      playerService.getPlayer.mockResolvedValue(player);
      const response = await controller.movePlayer({
        teamId: 'T1',
        userId: 'U1',
        move: { direction: 'north' } as never,
      });

      expect(response).toEqual({
        success: true,
        player,
        monsters: [{ id: 10, name: 'Goblin' }],
        playersAtLocation: [{ id: 2 }],
      });
    });

    it('returns fallback when move fails but player exists', async () => {
      playerService.movePlayer.mockRejectedValue(new Error('blocked'));
      playerService.getPlayer.mockResolvedValue({ id: 1, name: 'Hero' });

      const response = await controller.movePlayer({
        teamId: 'T1',
        userId: 'U1',
        move: { direction: 'north' } as never,
      });

      expect(response.success).toBe(false);
      expect(response.player?.name).toBe('Hero');
      expect(response.message).toBe('blocked');
    });
  });
});
