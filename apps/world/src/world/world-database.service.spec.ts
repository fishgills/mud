import { WorldDatabaseService } from './world-database.service';
import { BIOMES } from '../constants';
import { PrismaService } from '../prisma/prisma.service';

type PrismaServiceMock = {
  biome: {
    upsert: jest.Mock<Promise<unknown>, [unknown]>;
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
  };
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
      biome: {
        upsert: jest.fn<Promise<unknown>, [unknown]>(),
        findUnique: jest.fn<Promise<unknown>, [unknown]>(),
      },
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
    it('should upsert all biomes', async () => {
      await service.initializeBiomes();

      const biomeValues = Object.values(BIOMES);
      expect(prismaService.biome.upsert).toHaveBeenCalledTimes(
        biomeValues.length,
      );

      biomeValues.forEach((biome) => {
        expect(prismaService.biome.upsert).toHaveBeenCalledWith({
          where: { id: biome.id },
          update: { name: biome.name },
          create: { id: biome.id, name: biome.name },
        });
      });
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

      const createCall = prismaService.worldSeed.create.mock.calls[0][0];
      const data = createCall.data;

      expect(data.temperatureSeed).toBe(data.seed + 1000);
      expect(data.moistureSeed).toBe(data.seed + 2000);
    });
  });

  describe('getBiomeById', () => {
    it('should return biome by id', async () => {
      const mockBiome = { id: 1, name: 'Forest' };
      prismaService.biome.findUnique.mockResolvedValue(mockBiome);

      const result = await service.getBiomeById(1);

      expect(result).toEqual(mockBiome);
      expect(prismaService.biome.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null for non-existent biome', async () => {
      prismaService.biome.findUnique.mockResolvedValue(null);

      const result = await service.getBiomeById(999);

      expect(result).toBeNull();
    });
  });
});
