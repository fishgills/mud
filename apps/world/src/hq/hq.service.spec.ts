import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HqService } from './hq.service';
import { HQ_COORDINATE } from './hq.constants';

const mockPrisma = () => ({
  player: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
});

const mockSpawn = () => ({
  findSafeSpawn: jest.fn(),
});

describe('HqService', () => {
  const prisma = mockPrisma();
  const spawn = mockSpawn();
  const service = new HqService(prisma as never, spawn as never);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('enter', () => {
    it('moves player into HQ and records last world position', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 1,
        x: 10,
        y: -5,
        isInHq: false,
        lastWorldX: null,
        lastWorldY: null,
      });
      prisma.player.update.mockResolvedValue({
        id: 1,
        isInHq: true,
        x: HQ_COORDINATE.x,
        y: HQ_COORDINATE.y,
      });

      const result = await service.enter(1);

      expect(prisma.player.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1 },
          data: expect.objectContaining({
            isInHq: true,
            lastWorldX: 10,
            lastWorldY: -5,
            x: HQ_COORDINATE.x,
            y: HQ_COORDINATE.y,
          }),
        }),
      );
      expect(result).toMatchObject({
        playerId: 1,
        isInHq: true,
        lastWorldPosition: { x: 10, y: -5 },
      });
    });

    it('returns existing status when already in HQ', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 2,
        x: HQ_COORDINATE.x,
        y: HQ_COORDINATE.y,
        isInHq: true,
        lastWorldX: 3,
        lastWorldY: 4,
      });

      const result = await service.enter(2);

      expect(prisma.player.update).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        playerId: 2,
        isInHq: true,
        lastWorldPosition: { x: 3, y: 4 },
      });
    });

    it('throws when player missing', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(service.enter(999)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('exit', () => {
    it('restores player to last world position when available', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 5,
        isInHq: true,
        lastWorldX: 8,
        lastWorldY: -12,
      });
      prisma.player.update.mockResolvedValue({
        id: 5,
        isInHq: false,
        x: 8,
        y: -12,
      });

      const result = await service.exit(5, 'return');

      expect(spawn.findSafeSpawn).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        playerId: 5,
        isInHq: false,
        location: { x: 8, y: -12 },
        mode: 'return',
      });
    });

    it('uses spawn selector when return unavailable', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 6,
        isInHq: true,
        lastWorldX: null,
        lastWorldY: null,
      });
      spawn.findSafeSpawn.mockResolvedValue({
        x: 20,
        y: 30,
        biomeName: 'grassland',
      });
      prisma.player.update.mockResolvedValue({
        id: 6,
        isInHq: false,
        x: 20,
        y: 30,
      });

      const result = await service.exit(6, 'return');

      expect(spawn.findSafeSpawn).toHaveBeenCalledWith(6, null);
      expect(result.mode).toBe('random');
      expect(result.location).toEqual({ x: 20, y: 30 });
    });

    it('rejects exiting when not in HQ', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 7,
        isInHq: false,
      });

      await expect(service.exit(7, 'random')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('getStatus', () => {
    it('returns persisted HQ state', async () => {
      prisma.player.findUnique.mockResolvedValue({
        id: 9,
        isInHq: true,
        x: HQ_COORDINATE.x,
        y: HQ_COORDINATE.y,
        lastWorldX: 1,
        lastWorldY: 2,
      });

      const result = await service.getStatus(9);

      expect(result).toEqual({
        playerId: 9,
        isInHq: true,
        location: { x: HQ_COORDINATE.x, y: HQ_COORDINATE.y },
        lastWorldPosition: { x: 1, y: 2 },
      });
    });
  });
});
