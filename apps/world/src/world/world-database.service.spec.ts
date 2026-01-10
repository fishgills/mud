import { WorldDatabaseService } from './world-database.service';
import { PrismaService } from '../prisma/prisma.service';
import { getBiomeById, BiomeId } from '@mud/constants';

type PrismaServiceMock = {
  worldSeed: {
    findFirst: jest.Mock<Promise<unknown>, [unknown]>;
    create: jest.Mock<Promise<unknown>, [unknown]>;
  };
};

describe('WorldDatabaseService', () => {
  let service: WorldDatabaseService;
  let prismaService: PrismaServiceMock;

  beforeEach(() => {
    prismaService = {
      worldSeed: {
        findFirst: jest.fn<Promise<unknown>, [unknown]>(),
        create: jest.fn<Promise<unknown>, [unknown]>(),
      },
    };

    service = new WorldDatabaseService(
      prismaService as unknown as PrismaService,
    );
  });

  describe('initializeBiomes', () => {
    it('should complete without database calls (biomes are now in TypeScript)', async () => {
      // Biomes are no longer stored in the database
      await service.initializeBiomes();
      // No assertions needed - just verify it doesn't throw
    });
  });

  describe('loadWorldSeed', () => {
    it('should return existing active seed', async () => {
      const mockSeed = {
        id: 1,
        seed: 12345,
        isActive: true,
        heightSeed: 12345,
        temperatureSeed: 13345,
        moistureSeed: 14345,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      prismaService.worldSeed.findFirst.mockResolvedValue(mockSeed);

      const result = await service.loadWorldSeed();

      expect(result).toBe(12345);
      expect(prismaService.worldSeed.findFirst).toHaveBeenCalledWith({
        where: { isActive: true },
      });
      expect(prismaService.worldSeed.create).not.toHaveBeenCalled();
    });

    it('should create new seed if none exists', async () => {
      prismaService.worldSeed.findFirst.mockResolvedValue(null);
      prismaService.worldSeed.create.mockResolvedValue({
        id: 1,
        seed: 54321,
        isActive: true,
        heightSeed: 54321,
        temperatureSeed: 55321,
        moistureSeed: 56321,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.loadWorldSeed();

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1000000);
      expect(prismaService.worldSeed.create).toHaveBeenCalledWith({
        data: {
          seed: expect.any(Number),
          heightSeed: expect.any(Number),
          temperatureSeed: expect.any(Number),
          moistureSeed: expect.any(Number),
        },
      });
    });

    it('should create seed with derived values', async () => {
      prismaService.worldSeed.findFirst.mockResolvedValue(null);

      await service.loadWorldSeed();

      const createCall = prismaService.worldSeed.create.mock.calls[0][0] as {
        data: { seed: number; temperatureSeed: number; moistureSeed: number };
      };
      const data = createCall.data;

      expect(data.temperatureSeed).toBe(data.seed + 1000);
      expect(data.moistureSeed).toBe(data.seed + 2000);
    });
  });

  describe('getBiomeById', () => {
    it('should return biome by id from TypeScript constants', () => {
      const result = service.getBiomeById(BiomeId.FOREST);

      expect(result).toEqual(getBiomeById(BiomeId.FOREST));
      expect(result.name).toBe('Forest');
    });

    it('should return correct biome for any valid BiomeId', () => {
      const ocean = service.getBiomeById(BiomeId.OCEAN);
      expect(ocean.name).toBe('Ocean');

      const desert = service.getBiomeById(BiomeId.DESERT);
      expect(desert.name).toBe('Desert');
    });
  });
});
