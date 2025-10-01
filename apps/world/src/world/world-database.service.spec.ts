import { WorldDatabaseService } from './world-database.service';
import { PrismaService } from '../prisma/prisma.service';
import { BIOMES } from '../constants';

describe('WorldDatabaseService', () => {
  let service: WorldDatabaseService;
  let prismaService: any;

  beforeEach(() => {
    prismaService = {
      biome: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
      },
      worldSeed: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      settlement: {
        createMany: jest.fn(),
        findMany: jest.fn(),
      },
    };

    service = new WorldDatabaseService(prismaService);
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

  describe('saveChunkSettlements', () => {
    it('should save settlements', async () => {
      const settlements = [
        {
          name: 'Test City',
          type: 'city',
          size: 'large',
          population: 10000,
          x: 100,
          y: 200,
          description: 'A test city',
        },
        {
          name: 'Test Village',
          type: 'village',
          size: 'small',
          population: 500,
          x: 150,
          y: 250,
          description: 'A test village',
        },
      ];

      await service.saveChunkSettlements(settlements);

      expect(prismaService.settlement.createMany).toHaveBeenCalledWith({
        data: settlements,
        skipDuplicates: true,
      });
    });

    it('should handle empty settlements array', async () => {
      await service.saveChunkSettlements([]);

      expect(prismaService.settlement.createMany).not.toHaveBeenCalled();
    });

    it('should handle null settlements', async () => {
      await service.saveChunkSettlements(null as any);

      expect(prismaService.settlement.createMany).not.toHaveBeenCalled();
    });

    it('should handle undefined settlements', async () => {
      await service.saveChunkSettlements(undefined as any);

      expect(prismaService.settlement.createMany).not.toHaveBeenCalled();
    });
  });

  describe('getSettlementsInRadius', () => {
    it('should query settlements within radius', async () => {
      const mockSettlements = [
        {
          id: 1,
          name: 'Nearby City',
          x: 105,
          y: 205,
          type: 'city',
          size: 'medium',
          population: 5000,
          description: 'Close by',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prismaService.settlement.findMany.mockResolvedValue(mockSettlements);

      const result = await service.getSettlementsInRadius(100, 200, 50);

      expect(result).toEqual(mockSettlements);
      expect(prismaService.settlement.findMany).toHaveBeenCalledWith({
        where: {
          x: { gte: 50, lte: 150 },
          y: { gte: 150, lte: 250 },
        },
      });
    });

    it('should handle radius of 0', async () => {
      prismaService.settlement.findMany.mockResolvedValue([]);

      await service.getSettlementsInRadius(100, 200, 0);

      expect(prismaService.settlement.findMany).toHaveBeenCalledWith({
        where: {
          x: { gte: 100, lte: 100 },
          y: { gte: 200, lte: 200 },
        },
      });
    });
  });

  describe('getSettlementsInBounds', () => {
    it('should query settlements within bounds', async () => {
      const mockSettlements = [
        {
          id: 1,
          name: 'Bounded City',
          x: 15,
          y: 25,
          type: 'city',
          size: 'large',
          population: 8000,
          description: 'Within bounds',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      prismaService.settlement.findMany.mockResolvedValue(mockSettlements);

      const result = await service.getSettlementsInBounds(10, 20, 30, 40);

      expect(result).toEqual(mockSettlements);
      expect(prismaService.settlement.findMany).toHaveBeenCalledWith({
        where: {
          x: { gte: 10, lte: 30 },
          y: { gte: 20, lte: 40 },
        },
      });
    });

    it('should handle negative bounds', async () => {
      prismaService.settlement.findMany.mockResolvedValue([]);

      await service.getSettlementsInBounds(-50, -40, -10, -5);

      expect(prismaService.settlement.findMany).toHaveBeenCalledWith({
        where: {
          x: { gte: -50, lte: -10 },
          y: { gte: -40, lte: -5 },
        },
      });
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
