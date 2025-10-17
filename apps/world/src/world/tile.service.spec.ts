import { TileService } from './tile.service';
import { WorldDatabaseService } from './world-database.service';
import { WorldUtilsService } from './world-utils.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { Settlement } from '@mud/database';
import type { WorldTile } from './models/world-tile.model';

type WorldDatabaseMock = Pick<
  WorldDatabaseService,
  'loadWorldSeed' | 'getSettlementsInRadius'
>;
type WorldUtilsMock = Pick<
  WorldUtilsService,
  | 'calculateDistance'
  | 'calculateDirection'
  | 'roundToDecimalPlaces'
  | 'getChunkCoordinates'
>;
type ChunkGeneratorMock = {
  generateTileAt: (
    ...args: Parameters<ChunkGeneratorService['generateTileAt']>
  ) => WorldTile | null;
};

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

describe('TileService', () => {
  let service: TileService;
  let worldDatabase: jest.Mocked<WorldDatabaseMock>;
  let worldUtils: jest.Mocked<WorldUtilsMock>;
  let chunkGenerator: jest.Mocked<ChunkGeneratorMock>;

  const mockTile: WorldTile = {
    id: 1,
    x: 10,
    y: 20,
    biomeId: 1,
    biomeName: 'Forest',
    description: null,
    height: 0.5,
    temperature: 0.6,
    moisture: 0.7,
    seed: 12345,
    chunkX: 0,
    chunkY: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    biome: null,
  };

  beforeEach(() => {
    worldDatabase = {
      loadWorldSeed: jest.fn<
        ReturnType<WorldDatabaseService['loadWorldSeed']>,
        Parameters<WorldDatabaseService['loadWorldSeed']>
      >(() => Promise.resolve(12345)),
      getSettlementsInRadius: jest.fn<
        ReturnType<WorldDatabaseService['getSettlementsInRadius']>,
        Parameters<WorldDatabaseService['getSettlementsInRadius']>
      >(() => Promise.resolve([])),
    };

    worldUtils = {
      calculateDistance: jest.fn<
        ReturnType<WorldUtilsService['calculateDistance']>,
        Parameters<WorldUtilsService['calculateDistance']>
      >((x1, y1, x2, y2) => {
        const dx = x2 - x1;
        const dy = y2 - y1;
        return Math.sqrt(dx * dx + dy * dy);
      }),
      calculateDirection: jest.fn<
        ReturnType<WorldUtilsService['calculateDirection']>,
        Parameters<WorldUtilsService['calculateDirection']>
      >(() => 'North'),
      roundToDecimalPlaces: jest.fn<
        ReturnType<WorldUtilsService['roundToDecimalPlaces']>,
        Parameters<WorldUtilsService['roundToDecimalPlaces']>
      >((val) => Math.round(val * 10) / 10),
      getChunkCoordinates: jest.fn<
        ReturnType<WorldUtilsService['getChunkCoordinates']>,
        Parameters<WorldUtilsService['getChunkCoordinates']>
      >((x, y) => ({
        chunkX: Math.floor(x / WorldUtilsService.CHUNK_SIZE),
        chunkY: Math.floor(y / WorldUtilsService.CHUNK_SIZE),
      })),
    };

    chunkGenerator = {
      generateTileAt: jest.fn<
        ReturnType<ChunkGeneratorMock['generateTileAt']>,
        Parameters<ChunkGeneratorService['generateTileAt']>
      >(() => mockTile),
    };

    service = new TileService(
      worldDatabase as unknown as WorldDatabaseService,
      worldUtils as unknown as WorldUtilsService,
      chunkGenerator as unknown as ChunkGeneratorService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getTile', () => {
    it('should return a tile at given coordinates', async () => {
      const result = await service.getTile(10, 20);

      expect(result).toEqual(mockTile);
      expect(chunkGenerator.generateTileAt).toHaveBeenCalledWith(10, 20, 12345);
    });

    it('should load world seed on first call', async () => {
      await service.getTile(10, 20);

      expect(worldDatabase.loadWorldSeed).toHaveBeenCalled();
    });

    it('should not reload world seed on subsequent calls', async () => {
      await service.getTile(10, 20);
      await service.getTile(15, 25);

      expect(worldDatabase.loadWorldSeed).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTileWithNearbyBiomes', () => {
    beforeEach(() => {
      chunkGenerator.generateTileAt.mockReturnValue(mockTile);
    });

    it('should return tile with nearby biomes and settlements', async () => {
      const nearbyTile = { ...mockTile, x: 11, y: 20, biomeName: 'Plains' };
      chunkGenerator.generateTileAt
        .mockReturnValueOnce(mockTile)
        .mockReturnValueOnce(nearbyTile as unknown as WorldTile);

      const result = await service.getTileWithNearbyBiomes(10, 20);

      expect(result).toBeDefined();
      expect(result.x).toBe(10);
      expect(result.y).toBe(20);
      expect(result.nearbyBiomes).toBeDefined();
      expect(result.nearbySettlements).toBeDefined();
    });

    it('should throw error if tile not found', async () => {
      chunkGenerator.generateTileAt.mockReturnValueOnce(null);

      await expect(service.getTileWithNearbyBiomes(10, 20)).rejects.toThrow(
        'Tile not found at 10,20',
      );
    });

    it('should include current settlement if tile is at settlement center', async () => {
      const settlement = createSettlement({
        id: 1,
        name: 'Test City',
        x: 10,
        y: 20,
        type: 'city',
        size: 'large',
        population: 10000,
        description: 'A test city',
      });

      worldDatabase.getSettlementsInRadius.mockResolvedValueOnce([settlement]);
      chunkGenerator.generateTileAt.mockReturnValue(mockTile);

      const result = await service.getTileWithNearbyBiomes(10, 20);

      expect(result.currentSettlement).toBeDefined();
      expect(result.currentSettlement?.name).toBe('Test City');
      expect(result.currentSettlement?.isCenter).toBe(true);
      expect(result.currentSettlement?.intensity).toBe(1.0);
    });
  });

  describe('findNearbyBiomes', () => {
    it('should find biomes in expanding radius', async () => {
      const forestTile = { ...mockTile, biomeName: 'Forest' };
      const plainsTile = { ...mockTile, x: 11, y: 20, biomeName: 'Plains' };
      const mountainTile = {
        ...mockTile,
        x: 12,
        y: 20,
        biomeName: 'Mountains',
      };

      chunkGenerator.generateTileAt
        .mockReturnValueOnce(forestTile as unknown as WorldTile)
        .mockReturnValueOnce(plainsTile as unknown as WorldTile)
        .mockReturnValueOnce(mountainTile as unknown as WorldTile);

      const result = await service.findNearbyBiomes(10, 20, 'Forest');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('biomeName');
      expect(result[0]).toHaveProperty('distance');
      expect(result[0]).toHaveProperty('direction');
    });

    it('should not include current biome in results', async () => {
      const forestTile = { ...mockTile, biomeName: 'Forest' };
      chunkGenerator.generateTileAt.mockReturnValue(
        forestTile as unknown as WorldTile,
      );

      const result = await service.findNearbyBiomes(10, 20, 'Forest');

      const forestBiomes = result.filter((b) => b.biomeName === 'Forest');
      expect(forestBiomes.length).toBe(0);
    });

    it('should limit results to 5 biomes', async () => {
      const biomes = [
        'Plains',
        'Mountains',
        'Desert',
        'Ocean',
        'Swamp',
        'Tundra',
      ];
      let callCount = 0;

      chunkGenerator.generateTileAt.mockImplementation(
        () =>
          ({
            ...mockTile,
            biomeName: biomes[callCount++ % biomes.length],
          }) as unknown as WorldTile,
      );

      const result = await service.findNearbyBiomes(10, 20, 'Forest');

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('analyzeSettlements', () => {
    it('should return empty arrays when no settlements nearby', async () => {
      worldDatabase.getSettlementsInRadius.mockResolvedValueOnce([]);

      const result = await service.analyzeSettlements(10, 20);

      expect(result.nearbySettlements).toEqual([]);
      expect(result.currentSettlement).toBeUndefined();
    });

    it('should identify current settlement at center', async () => {
      const settlement = createSettlement({
        id: 1,
        name: 'Central City',
        x: 10,
        y: 20,
        type: 'city',
        size: 'large',
        population: 50000,
        description: 'Main city',
      });

      worldDatabase.getSettlementsInRadius.mockResolvedValueOnce([settlement]);

      const result = await service.analyzeSettlements(10, 20);

      expect(result.currentSettlement).toBeDefined();
      expect(result.currentSettlement?.name).toBe('Central City');
      expect(result.currentSettlement?.isCenter).toBe(true);
    });

    it('should calculate distances for nearby settlements', async () => {
      const settlements = [
        createSettlement({
          id: 1,
          name: 'City A',
          x: 15,
          y: 20,
          type: 'city',
          size: 'medium',
          population: 20000,
          description: 'City A',
        }),
        createSettlement({
          id: 2,
          name: 'City B',
          x: 20,
          y: 25,
          type: 'town',
          size: 'small',
          population: 5000,
          description: 'City B',
        }),
      ];

      worldDatabase.getSettlementsInRadius.mockResolvedValueOnce(settlements);

      const result = await service.analyzeSettlements(10, 20);

      expect(result.nearbySettlements.length).toBeGreaterThanOrEqual(1);
      expect(result.nearbySettlements[0]).toHaveProperty('distance');
      expect(result.nearbySettlements[0]).toHaveProperty('name');
      expect(result.nearbySettlements[0]).toHaveProperty('x');
      expect(result.nearbySettlements[0]).toHaveProperty('y');
    });

    it('should sort settlements by distance', async () => {
      const settlements = [
        createSettlement({
          id: 1,
          name: 'Near Town',
          x: 12,
          y: 22,
          type: 'town',
          size: 'medium',
          population: 10000,
          description: 'Near',
        }),
        createSettlement({
          id: 2,
          name: 'Medium Town',
          x: 20,
          y: 30,
          type: 'town',
          size: 'small',
          population: 5000,
          description: 'Medium distance',
        }),
      ];

      worldDatabase.getSettlementsInRadius.mockResolvedValueOnce(settlements);

      const result = await service.analyzeSettlements(10, 20);

      // First settlement should be closer (Near Town) if multiple exist
      if (result.nearbySettlements.length >= 2) {
        expect(result.nearbySettlements[0].distance).toBeLessThan(
          result.nearbySettlements[1].distance,
        );
      } else {
        // At least one settlement should be returned
        expect(result.nearbySettlements.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('reconstructChunkFromTiles', () => {
    it('should calculate correct biome distribution', () => {
      const tiles = [
        { ...mockTile, biomeName: 'Forest' },
        { ...mockTile, biomeName: 'Forest' },
        { ...mockTile, biomeName: 'Plains' },
      ];

      const result = service.reconstructChunkFromTiles(tiles);

      expect(result.stats.biomes).toEqual({ Forest: 2, Plains: 1 });
    });

    it('should calculate average statistics', () => {
      const tiles = [
        { ...mockTile, height: 0.5, temperature: 0.6, moisture: 0.7 },
        { ...mockTile, height: 0.3, temperature: 0.4, moisture: 0.5 },
        { ...mockTile, height: 0.7, temperature: 0.8, moisture: 0.9 },
      ];

      const result = service.reconstructChunkFromTiles(tiles);

      expect(result.stats.averageHeight).toBeCloseTo(0.5, 1);
      expect(result.stats.averageTemperature).toBeCloseTo(0.6, 1);
      expect(result.stats.averageMoisture).toBeCloseTo(0.7, 1);
    });

    it('should include all tiles in result', () => {
      const tiles = [mockTile, { ...mockTile, x: 11 }, { ...mockTile, x: 12 }];

      const result = service.reconstructChunkFromTiles(tiles);

      expect(result.tiles).toEqual(tiles);
      expect(result.tiles.length).toBe(3);
    });

    it('should have empty settlements array', () => {
      const result = service.reconstructChunkFromTiles([mockTile]);

      expect(result.settlements).toEqual([]);
    });
  });
});
