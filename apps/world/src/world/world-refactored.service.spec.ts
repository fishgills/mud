import { WorldService } from './world-refactored.service';
import { WorldDatabaseService } from './world-database.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { TileService } from './tile.service';
import { WorldUtilsService } from './world-utils.service';

describe('WorldService', () => {
  let service: WorldService;
  let mockWorldDatabase: jest.Mocked<WorldDatabaseService>;
  let mockChunkGenerator: jest.Mocked<ChunkGeneratorService>;
  let mockTileService: jest.Mocked<TileService>;
  let mockWorldUtils: jest.Mocked<WorldUtilsService>;

  beforeEach(() => {
    mockWorldDatabase = {
      initializeBiomes: jest.fn().mockResolvedValue(undefined),
      loadWorldSeed: jest.fn().mockResolvedValue(12345),
      saveChunkSettlements: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockChunkGenerator = {
      generateChunk: jest.fn().mockReturnValue({
        tiles: [],
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      }),
      generateTileAt: jest.fn().mockReturnValue({
        x: 0,
        y: 0,
        biomeId: 1,
        biomeName: 'Plains',
        height: 0.5,
        temperature: 0.5,
        moisture: 0.5,
      }),
    } as any;

    mockTileService = {
      findNearbyBiomes: jest.fn().mockResolvedValue([]),
      analyzeSettlements: jest.fn().mockResolvedValue({
        nearbySettlements: [],
        currentSettlement: null,
      }),
    } as any;

    mockWorldUtils = {
      getMinDistanceBetweenSettlements: jest.fn().mockReturnValue(100),
    } as any;

    service = new WorldService(
      mockWorldDatabase,
      mockChunkGenerator,
      mockTileService,
      mockWorldUtils,
    );
  });

  describe('getCurrentSeed', () => {
    it('should return the current seed', async () => {
      // Wait for async initialization
      await new Promise((resolve) => setTimeout(resolve, 10));

      const seed = service.getCurrentSeed();
      expect(seed).toBe(12345);
    });
  });

  describe('getChunk', () => {
    it('should generate a chunk using the chunk generator', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await service.getChunk(0, 0);

      expect(mockChunkGenerator.generateChunk).toHaveBeenCalledWith(
        0,
        0,
        12345,
      );
      expect(result).toBeDefined();
      expect(result.tiles).toBeDefined();
    });

    it('should save settlements if any are generated', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockSettlement = {
        id: 1,
        name: 'Test City',
        x: 10,
        y: 20,
        type: 'city',
        size: 'large',
        population: 1000,
        description: 'A test city',
      };

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: [],
        settlements: [mockSettlement] as any,
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      });

      await service.getChunk(0, 0);

      expect(mockWorldDatabase.saveChunkSettlements).toHaveBeenCalledWith([
        mockSettlement,
      ]);
    });

    it('should not save settlements if none are generated', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      await service.getChunk(0, 0);

      expect(mockWorldDatabase.saveChunkSettlements).not.toHaveBeenCalled();
    });
  });

  describe('getTileWithNearbyBiomes', () => {
    it('should return tile with nearby biomes and settlements', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await service.getTileWithNearbyBiomes(10, 20);

      expect(mockChunkGenerator.generateTileAt).toHaveBeenCalledWith(
        10,
        20,
        12345,
      );
      expect(mockTileService.findNearbyBiomes).toHaveBeenCalled();
      expect(mockTileService.analyzeSettlements).toHaveBeenCalledWith(10, 20);
      expect(result).toBeDefined();
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
    });
  });

  describe('generateMissingChunk', () => {
    it('should delegate to getChunk', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const spy = jest.spyOn(service, 'getChunk');

      await service.generateMissingChunk(1, 2);

      expect(spy).toHaveBeenCalledWith(1, 2);
    });
  });

  describe('getMinDistanceBetweenSettlements', () => {
    it('should delegate to worldUtils', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = service.getMinDistanceBetweenSettlements('large');

      expect(
        mockWorldUtils.getMinDistanceBetweenSettlements,
      ).toHaveBeenCalledWith('large');
      expect(result).toBe(100);
    });
  });

  describe('isCoordinateInSettlement', () => {
    it('should return false when no settlements match', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const settlements: any[] = [
        {
          x: 100,
          y: 100,
          size: 'small',
          type: 'village',
          population: 50,
        },
      ];

      const result = service.isCoordinateInSettlement(0, 0, settlements);

      expect(result.isSettlement).toBe(false);
      expect(result.intensity).toBe(0);
      expect(result.settlement).toBeUndefined();
    });

    it('should return true when coordinate is in settlement footprint', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const settlements: any[] = [
        {
          x: 0,
          y: 0,
          size: 'small',
          type: 'village',
          population: 50,
        },
      ];

      // The regenerateSettlementFootprint will generate tiles around (0,0)
      const result = service.isCoordinateInSettlement(0, 0, settlements);

      // Should find the settlement at the center
      expect(result.isSettlement).toBe(true);
      expect(result.settlement).toBeDefined();
      expect(result.intensity).toBeGreaterThan(0);
    });
  });

  describe('getChunkTiles', () => {
    it('should return all tiles when no pagination params', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = Array.from({ length: 2500 }, (_, i) => ({
        x: i % 50,
        y: Math.floor(i / 50),
        biomeId: 1,
        biomeName: 'Plains',
        height: 0.5,
        temperature: 0.5,
        moisture: 0.5,
      }));

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: mockTiles as any,
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      });

      const result = await service.getChunkTiles(0, 0);

      expect(result).toHaveLength(2500);
    });

    it('should apply limit when provided', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = Array.from({ length: 2500 }, (_, i) => ({
        x: i % 50,
        y: Math.floor(i / 50),
        biomeId: 1,
        biomeName: 'Plains',
        height: 0.5,
        temperature: 0.5,
        moisture: 0.5,
      }));

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: mockTiles as any,
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      });

      const result = await service.getChunkTiles(0, 0, 10);

      expect(result).toHaveLength(10);
    });

    it('should apply offset and limit when provided', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = Array.from({ length: 2500 }, (_, i) => ({
        x: i % 50,
        y: Math.floor(i / 50),
        biomeId: 1,
        biomeName: 'Plains',
        height: 0.5,
        temperature: 0.5,
        moisture: 0.5,
      }));

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: mockTiles as any,
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      });

      const result = await service.getChunkTiles(0, 0, 10, 5);

      expect(result).toHaveLength(10);
      expect(result[0].x).toBe(5); // Offset by 5
    });
  });

  describe('getChunkTileCount', () => {
    it('should always return 2500 for 50x50 chunk', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = await service.getChunkTileCount(0, 0);

      expect(result).toBe(2500);
    });
  });

  describe('getChunkSettlements', () => {
    it('should fetch settlements in chunk bounds', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockWorldDatabase.getSettlementsInBounds = jest.fn().mockResolvedValue([
        { id: 1, name: 'Village', x: 10, y: 10 },
        { id: 2, name: 'Town', x: 30, y: 30 },
      ]);

      const result = await service.getChunkSettlements(0, 0);

      expect(mockWorldDatabase.getSettlementsInBounds).toHaveBeenCalledWith(
        0,
        0,
        49,
        49,
      );
      expect(result).toHaveLength(2);
    });

    it('should calculate correct bounds for negative chunk coordinates', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockWorldDatabase.getSettlementsInBounds = jest
        .fn()
        .mockResolvedValue([]);

      await service.getChunkSettlements(-1, -1);

      expect(mockWorldDatabase.getSettlementsInBounds).toHaveBeenCalledWith(
        -50,
        -50,
        -1,
        -1,
      );
    });
  });

  describe('getChunkStats', () => {
    it('should calculate average stats from tiles', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = [
        {
          x: 0,
          y: 0,
          biomeId: 1,
          biomeName: 'Plains',
          height: 0.3,
          temperature: 0.6,
          moisture: 0.4,
        },
        {
          x: 1,
          y: 0,
          biomeId: 1,
          biomeName: 'Plains',
          height: 0.7,
          temperature: 0.8,
          moisture: 0.6,
        },
      ];

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: mockTiles as any,
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.7,
          averageMoisture: 0.5,
        },
      });

      const result = await service.getChunkStats(0, 0);

      expect(result.averageHeight).toBe(0.5);
      expect(result.averageTemperature).toBe(0.7);
      expect(result.averageMoisture).toBe(0.5);
    });
  });

  describe('getChunkBiomeStats', () => {
    it('should count tiles by biome', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = [
        {
          x: 0,
          y: 0,
          biomeId: 1,
          biomeName: 'Plains',
          height: 0.5,
          temperature: 0.5,
          moisture: 0.5,
        },
        {
          x: 1,
          y: 0,
          biomeId: 1,
          biomeName: 'Plains',
          height: 0.5,
          temperature: 0.5,
          moisture: 0.5,
        },
        {
          x: 2,
          y: 0,
          biomeId: 2,
          biomeName: 'Forest',
          height: 0.6,
          temperature: 0.6,
          moisture: 0.7,
        },
      ];

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: mockTiles as any,
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      });

      const result = await service.getChunkBiomeStats(0, 0);

      expect(result).toHaveLength(2);
      expect(result.find((b) => b.biomeName === 'Plains')?.count).toBe(2);
      expect(result.find((b) => b.biomeName === 'Forest')?.count).toBe(1);
    });

    it('should handle tiles without biomeName', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = [
        {
          x: 0,
          y: 0,
          biomeId: 1,
          biomeName: null as any,
          height: 0.5,
          temperature: 0.5,
          moisture: 0.5,
        },
        {
          x: 1,
          y: 0,
          biomeId: 2,
          biomeName: 'Forest',
          height: 0.6,
          temperature: 0.6,
          moisture: 0.7,
        },
      ];

      mockChunkGenerator.generateChunk.mockReturnValue({
        tiles: mockTiles as any,
        settlements: [],
        stats: {
          biomes: {},
          averageHeight: 0.5,
          averageTemperature: 0.5,
          averageMoisture: 0.5,
        },
      });

      const result = await service.getChunkBiomeStats(0, 0);

      expect(result).toHaveLength(1);
      expect(result[0].biomeName).toBe('Forest');
    });
  });

  describe('error handling', () => {
    it('should handle errors in getChunk', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      mockChunkGenerator.generateChunk.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      await expect(service.getChunk(0, 0)).rejects.toThrow('Generation failed');
    });

    it('should handle initialization errors gracefully', async () => {
      mockWorldDatabase.initializeBiomes.mockRejectedValue(
        new Error('DB init failed'),
      );

      // Create new service with failing init
      const failService = new WorldService(
        mockWorldDatabase,
        mockChunkGenerator,
        mockTileService,
        mockWorldUtils,
      );

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Service should still be usable, just with default seed
      expect(failService.getCurrentSeed()).toBe(0);
    });
  });
});
