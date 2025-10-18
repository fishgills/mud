import { WorldService } from './world-refactored.service';
import { WorldDatabaseService } from './world-database.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { TileService } from './tile.service';
import { WorldUtilsService } from './world-utils.service';
import type { ChunkData } from './types';
import type { Settlement } from '@mud/database';
import type { WorldTile } from './models';

type WorldDatabaseMock = Pick<
  WorldDatabaseService,
  | 'initializeBiomes'
  | 'loadWorldSeed'
  | 'saveChunkSettlements'
  | 'getSettlementsInBounds'
  | 'getSettlementsInRadius'
>;
type ChunkGeneratorMock = Pick<
  ChunkGeneratorService,
  'generateChunk' | 'generateTileAt'
>;
type TileServiceMock = Pick<
  TileService,
  'findNearbyBiomes' | 'analyzeSettlements'
>;
type WorldUtilsMock = Pick<
  WorldUtilsService,
  | 'getMinDistanceBetweenSettlements'
  | 'calculateDistance'
  | 'calculateDirection'
  | 'roundToDecimalPlaces'
>;

const createWorldTile = (overrides: Partial<WorldTile> = {}): WorldTile => ({
  id: overrides.id ?? 0,
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  biomeId: overrides.biomeId ?? 1,
  biomeName: overrides.biomeName ?? 'Plains',
  description: overrides.description ?? null,
  height: overrides.height ?? 0.5,
  temperature: overrides.temperature ?? 0.5,
  moisture: overrides.moisture ?? 0.5,
  seed: overrides.seed ?? 12345,
  chunkX: overrides.chunkX ?? 0,
  chunkY: overrides.chunkY ?? 0,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  biome: overrides.biome ?? null,
});

const createChunkData = (overrides: Partial<ChunkData> = {}): ChunkData => ({
  tiles: overrides.tiles ?? [],
  settlements: overrides.settlements ?? [],
  stats: {
    biomes: overrides.stats?.biomes ?? {},
    averageHeight: overrides.stats?.averageHeight ?? 0.5,
    averageTemperature: overrides.stats?.averageTemperature ?? 0.5,
    averageMoisture: overrides.stats?.averageMoisture ?? 0.5,
  },
});

const createSettlement = (overrides: Partial<Settlement> = {}): Settlement => {
  const base = {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Settlement',
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    type: overrides.type ?? 'village',
    size: overrides.size ?? 'small',
    population: overrides.population ?? 0,
    description: overrides.description ?? '',
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
  return base as unknown as Settlement;
};

describe('WorldService', () => {
  let service: WorldService;
  let mockWorldDatabase: jest.Mocked<WorldDatabaseMock>;
  let mockChunkGenerator: jest.Mocked<ChunkGeneratorMock>;
  let mockTileService: jest.Mocked<TileServiceMock>;
  let mockWorldUtils: jest.Mocked<WorldUtilsMock>;

  beforeEach(() => {
    mockWorldDatabase = {
      initializeBiomes: jest.fn<
        ReturnType<WorldDatabaseService['initializeBiomes']>,
        Parameters<WorldDatabaseService['initializeBiomes']>
      >(() => Promise.resolve()),
      loadWorldSeed: jest.fn<
        ReturnType<WorldDatabaseService['loadWorldSeed']>,
        Parameters<WorldDatabaseService['loadWorldSeed']>
      >(() => Promise.resolve(12345)),
      saveChunkSettlements: jest.fn<
        ReturnType<WorldDatabaseService['saveChunkSettlements']>,
        Parameters<WorldDatabaseService['saveChunkSettlements']>
      >(() => Promise.resolve()),
      getSettlementsInBounds: jest.fn<
        ReturnType<WorldDatabaseService['getSettlementsInBounds']>,
        Parameters<WorldDatabaseService['getSettlementsInBounds']>
      >(() => Promise.resolve([])),
      getSettlementsInRadius: jest.fn<
        ReturnType<WorldDatabaseService['getSettlementsInRadius']>,
        Parameters<WorldDatabaseService['getSettlementsInRadius']>
      >(() => Promise.resolve([])),
    };

    mockChunkGenerator = {
      generateChunk: jest.fn<
        ReturnType<ChunkGeneratorService['generateChunk']>,
        Parameters<ChunkGeneratorService['generateChunk']>
      >(() => createChunkData()),
      generateTileAt: jest.fn<
        ReturnType<ChunkGeneratorService['generateTileAt']>,
        Parameters<ChunkGeneratorService['generateTileAt']>
      >(() => createWorldTile()),
    };

    mockTileService = {
      findNearbyBiomes: jest.fn<
        ReturnType<TileService['findNearbyBiomes']>,
        Parameters<TileService['findNearbyBiomes']>
      >(() => Promise.resolve([])),
      analyzeSettlements: jest.fn<
        ReturnType<TileService['analyzeSettlements']>,
        Parameters<TileService['analyzeSettlements']>
      >(() =>
        Promise.resolve({
          nearbySettlements: [],
          currentSettlement: undefined,
        }),
      ),
    };

    mockWorldUtils = {
      getMinDistanceBetweenSettlements: jest.fn<
        ReturnType<WorldUtilsService['getMinDistanceBetweenSettlements']>,
        Parameters<WorldUtilsService['getMinDistanceBetweenSettlements']>
      >(() => 100),
      calculateDistance: jest.fn<
        ReturnType<WorldUtilsService['calculateDistance']>,
        Parameters<WorldUtilsService['calculateDistance']>
      >(() => 0),
      calculateDirection: jest.fn<
        ReturnType<WorldUtilsService['calculateDirection']>,
        Parameters<WorldUtilsService['calculateDirection']>
      >(() => 'north'),
      roundToDecimalPlaces: jest.fn<
        ReturnType<WorldUtilsService['roundToDecimalPlaces']>,
        Parameters<WorldUtilsService['roundToDecimalPlaces']>
      >((value) => value),
    };

    service = new WorldService(
      mockWorldDatabase as unknown as WorldDatabaseService,
      mockChunkGenerator as unknown as ChunkGeneratorService,
      mockTileService as unknown as TileService,
      mockWorldUtils as unknown as WorldUtilsService,
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

      const mockSettlement = createSettlement({
        id: 1,
        name: 'Test City',
        x: 10,
        y: 20,
        type: 'city',
        size: 'large',
        population: 1000,
        description: 'A test city',
      });

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({ settlements: [mockSettlement] }),
      );

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

  describe('findNearestSettlement', () => {
    beforeEach(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      mockWorldDatabase.getSettlementsInRadius.mockClear();
      mockWorldUtils.calculateDistance.mockClear();
      mockWorldUtils.calculateDirection.mockClear();
      mockWorldUtils.roundToDecimalPlaces.mockClear();
    });

    it('returns null when no settlements exist within the search radius', async () => {
      mockWorldDatabase.getSettlementsInRadius.mockResolvedValue([]);

      const result = await service.findNearestSettlement(0, 0, {
        maxRadius: 50,
        step: 50,
      });

      expect(result).toBeNull();
      expect(mockWorldDatabase.getSettlementsInRadius).toHaveBeenCalled();
    });

    it('returns the closest settlement with direction metadata', async () => {
      const settlement = createSettlement({
        id: 42,
        name: 'Fooville',
        x: 10,
        y: 0,
        type: 'town',
        size: 'medium',
        population: 750,
        description: 'Test settlement',
      });
      mockWorldDatabase.getSettlementsInRadius.mockResolvedValueOnce([
        settlement,
      ]);
      mockWorldUtils.calculateDistance.mockReturnValueOnce(10);
      mockWorldUtils.roundToDecimalPlaces.mockReturnValueOnce(10);
      mockWorldUtils.calculateDirection.mockReturnValueOnce('east');

      const result = await service.findNearestSettlement(0, 0, {
        maxRadius: 100,
        step: 50,
      });

      expect(result).toEqual({
        id: 42,
        name: 'Fooville',
        type: 'town',
        size: 'medium',
        population: 750,
        description: 'Test settlement',
        x: 10,
        y: 0,
        distance: 10,
        direction: 'east',
        isCurrent: false,
      });
      expect(mockWorldUtils.calculateDistance).toHaveBeenCalledWith(
        0,
        0,
        10,
        0,
      );
      expect(mockWorldUtils.calculateDirection).toHaveBeenCalledWith(
        0,
        0,
        10,
        0,
      );
    });
  });

  describe('isCoordinateInSettlement', () => {
    it('should return false when no settlements match', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const settlements = [
        createSettlement({
          x: 100,
          y: 100,
          size: 'small',
          type: 'village',
          population: 50,
        }),
      ];

      const result = service.isCoordinateInSettlement(0, 0, settlements);

      expect(result.isSettlement).toBe(false);
      expect(result.intensity).toBe(0);
      expect(result.settlement).toBeUndefined();
    });

    it('should return true when coordinate is in settlement footprint', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const settlements = [
        createSettlement({
          x: 0,
          y: 0,
          size: 'small',
          type: 'village',
          population: 50,
        }),
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

      const mockTiles = Array.from({ length: 2500 }, (_, i) =>
        createWorldTile({
          id: i,
          x: i % 50,
          y: Math.floor(i / 50),
        }),
      );

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({ tiles: mockTiles }),
      );

      const result = await service.getChunkTiles(0, 0);

      expect(result).toHaveLength(2500);
    });

    it('should apply limit when provided', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = Array.from({ length: 2500 }, (_, i) =>
        createWorldTile({
          id: i,
          x: i % 50,
          y: Math.floor(i / 50),
        }),
      );

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({ tiles: mockTiles }),
      );

      const result = await service.getChunkTiles(0, 0, 10);

      expect(result).toHaveLength(10);
    });

    it('should apply offset and limit when provided', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = Array.from({ length: 2500 }, (_, i) =>
        createWorldTile({
          id: i,
          x: i % 50,
          y: Math.floor(i / 50),
        }),
      );

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({ tiles: mockTiles }),
      );

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

      mockWorldDatabase.getSettlementsInBounds.mockResolvedValue([
        createSettlement({ id: 1, name: 'Village', x: 10, y: 10 }),
        createSettlement({ id: 2, name: 'Town', x: 30, y: 30 }),
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

      mockWorldDatabase.getSettlementsInBounds.mockResolvedValue([]);

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
        createWorldTile({
          id: 1,
          x: 0,
          y: 0,
          biomeName: 'Plains',
          height: 0.3,
          temperature: 0.6,
          moisture: 0.4,
        }),
        createWorldTile({
          id: 2,
          x: 1,
          y: 0,
          biomeName: 'Plains',
          height: 0.7,
          temperature: 0.8,
          moisture: 0.6,
        }),
      ];

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({
          tiles: mockTiles,
          stats: {
            biomes: {},
            averageHeight: 0.5,
            averageTemperature: 0.7,
            averageMoisture: 0.5,
          },
        }),
      );

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
        createWorldTile({ id: 1, x: 0, y: 0, biomeId: 1, biomeName: 'Plains' }),
        createWorldTile({ id: 2, x: 1, y: 0, biomeId: 1, biomeName: 'Plains' }),
        createWorldTile({ id: 3, x: 2, y: 0, biomeId: 2, biomeName: 'Forest' }),
      ];

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({ tiles: mockTiles }),
      );

      const result = await service.getChunkBiomeStats(0, 0);

      expect(result).toHaveLength(2);
      expect(result.find((b) => b.biomeName === 'Plains')?.count).toBe(2);
      expect(result.find((b) => b.biomeName === 'Forest')?.count).toBe(1);
    });

    it('should handle tiles without biomeName', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const mockTiles = [
        createWorldTile({ id: 1, x: 0, y: 0, biomeId: 1, biomeName: '' }),
        createWorldTile({ id: 2, x: 1, y: 0, biomeId: 2, biomeName: 'Forest' }),
      ];

      mockChunkGenerator.generateChunk.mockReturnValue(
        createChunkData({ tiles: mockTiles }),
      );

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
