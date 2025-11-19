import { WorldService } from './world-refactored.service';
import { WorldDatabaseService } from './world-database.service';
import { ChunkGeneratorService } from './chunk-generator.service';
import { TileService } from './tile.service';
import type { ChunkData } from './types';
import type { WorldTile } from './dto';

const flushPromises = async (): Promise<void> =>
  await new Promise((resolve) => setTimeout(resolve, 0));

type WorldDatabaseMock = Pick<
  WorldDatabaseService,
  'initializeBiomes' | 'loadWorldSeed'
>;
type ChunkGeneratorMock = Pick<
  ChunkGeneratorService,
  'generateChunk' | 'generateTileAt'
>;
type TileServiceMock = Pick<TileService, 'findNearbyBiomes'>;

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
  seed: overrides.seed ?? 6789,
  chunkX: overrides.chunkX ?? 0,
  chunkY: overrides.chunkY ?? 0,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  biome: overrides.biome ?? null,
});

const createChunkData = (overrides: Partial<ChunkData> = {}): ChunkData => ({
  chunkX: overrides.chunkX ?? 0,
  chunkY: overrides.chunkY ?? 0,
  tiles: overrides.tiles ?? [],
  paginatedTiles: overrides.paginatedTiles,
  stats: overrides.stats ?? {
    biomes: {},
    averageHeight: 0.5,
    averageTemperature: 0.5,
    averageMoisture: 0.5,
  },
  biomeStats: overrides.biomeStats,
});

describe('WorldService', () => {
  let service: WorldService;
  let worldDatabase: jest.Mocked<WorldDatabaseMock>;
  let chunkGenerator: jest.Mocked<ChunkGeneratorMock>;
  let tileService: jest.Mocked<TileServiceMock>;

  beforeEach(() => {
    worldDatabase = {
      initializeBiomes: jest.fn<
        ReturnType<WorldDatabaseService['initializeBiomes']>,
        Parameters<WorldDatabaseService['initializeBiomes']>
      >(() => Promise.resolve()),
      loadWorldSeed: jest.fn<
        ReturnType<WorldDatabaseService['loadWorldSeed']>,
        Parameters<WorldDatabaseService['loadWorldSeed']>
      >(() => Promise.resolve(6789)),
    } as jest.Mocked<WorldDatabaseMock>;

    chunkGenerator = {
      generateChunk: jest.fn<
        ReturnType<ChunkGeneratorService['generateChunk']>,
        Parameters<ChunkGeneratorService['generateChunk']>
      >((chunkX, chunkY, seed) => {
        void seed;
        return createChunkData({ chunkX, chunkY });
      }),
      generateTileAt: jest.fn<
        ReturnType<ChunkGeneratorService['generateTileAt']>,
        Parameters<ChunkGeneratorService['generateTileAt']>
      >((x, y, seed) => {
        void seed;
        return createWorldTile({ x, y });
      }),
    } as jest.Mocked<ChunkGeneratorMock>;

    tileService = {
      findNearbyBiomes: jest.fn<
        ReturnType<TileService['findNearbyBiomes']>,
        Parameters<TileService['findNearbyBiomes']>
      >(() => Promise.resolve([])),
    } as jest.Mocked<TileServiceMock>;

    service = new WorldService(
      worldDatabase as unknown as WorldDatabaseService,
      chunkGenerator as unknown as ChunkGeneratorService,
      tileService as unknown as TileService,
    );
  });

  describe('getCurrentSeed', () => {
    it('returns the loaded seed after initialization', async () => {
      await flushPromises();

      expect(service.getCurrentSeed()).toBe(6789);
    });
  });

  describe('getChunk', () => {
    it('delegates to the chunk generator with the active seed', async () => {
      await flushPromises();

      const result = await service.getChunk(1, 2);

      expect(chunkGenerator.generateChunk).toHaveBeenCalledWith(1, 2, 6789);
      expect(result.chunkX).toBe(1);
      expect(result.chunkY).toBe(2);
    });

    it('returns cached chunks within the TTL window', async () => {
      await flushPromises();

      const first = await service.getChunk(0, 0);
      const second = await service.getChunk(0, 0);

      expect(chunkGenerator.generateChunk).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });
  });

  describe('getTileWithNearbyBiomes', () => {
    it('produces a tile and enriches it with nearby biomes', async () => {
      await flushPromises();

      const result = await service.getTileWithNearbyBiomes(10, 15);

      expect(chunkGenerator.generateTileAt).toHaveBeenCalledWith(10, 15, 6789);
      expect(tileService.findNearbyBiomes).toHaveBeenCalledWith(
        10,
        15,
        'Plains',
      );
      expect(result.nearbyBiomes).toEqual([]);
      expect(result.x).toBe(10);
      expect(result.y).toBe(15);
    });
  });

  describe('generateMissingChunk', () => {
    it('reuses getChunk to perform generation', async () => {
      await flushPromises();
      const spy = jest.spyOn(service, 'getChunk');

      await service.generateMissingChunk(4, 5);

      expect(spy).toHaveBeenCalledWith(4, 5);
    });
  });

  describe('getChunkTiles', () => {
    it('returns the entire tile set by default', async () => {
      await flushPromises();
      const tiles = Array.from({ length: 2500 }, (_, i) =>
        createWorldTile({ id: i, x: i % 50, y: Math.floor(i / 50) }),
      );
      chunkGenerator.generateChunk.mockReturnValueOnce(
        createChunkData({ chunkX: 0, chunkY: 0, tiles }),
      );

      const result = await service.getChunkTiles(0, 0);

      expect(result).toHaveLength(2500);
    });

    it('applies a limit when provided', async () => {
      await flushPromises();
      const tiles = Array.from({ length: 100 }, (_, i) =>
        createWorldTile({ id: i, x: i, y: 0 }),
      );
      chunkGenerator.generateChunk.mockReturnValueOnce(
        createChunkData({ chunkX: 0, chunkY: 0, tiles }),
      );

      const result = await service.getChunkTiles(0, 0, 10);

      expect(result).toHaveLength(10);
    });

    it('applies offset and limit together', async () => {
      await flushPromises();
      const tiles = Array.from({ length: 50 }, (_, i) =>
        createWorldTile({ id: i, x: i, y: 0 }),
      );
      chunkGenerator.generateChunk.mockReturnValueOnce(
        createChunkData({ chunkX: 0, chunkY: 0, tiles }),
      );

      const result = await service.getChunkTiles(0, 0, 5, 3);

      expect(result).toHaveLength(5);
      expect(result[0].x).toBe(3);
    });
  });

  describe('getChunkTileCount', () => {
    it('always reports 2500 tiles for a chunk', async () => {
      await flushPromises();

      const count = await service.getChunkTileCount(2, 3);

      expect(count).toBe(2500);
    });
  });

  describe('getChunkStats', () => {
    it('derives averages from generated tiles', async () => {
      await flushPromises();
      const tiles = [
        createWorldTile({
          x: 0,
          y: 0,
          height: 0.25,
          temperature: 0.4,
          moisture: 0.3,
        }),
        createWorldTile({
          x: 1,
          y: 0,
          height: 0.75,
          temperature: 0.8,
          moisture: 0.7,
        }),
      ];
      chunkGenerator.generateChunk.mockReturnValueOnce(
        createChunkData({
          chunkX: 0,
          chunkY: 0,
          tiles,
          stats: {
            biomes: {},
            averageHeight: 0.5,
            averageTemperature: 0.6,
            averageMoisture: 0.5,
          },
        }),
      );

      const stats = await service.getChunkStats(0, 0);

      expect(stats.averageHeight).toBeCloseTo(0.5, 5);
      expect(stats.averageTemperature).toBeCloseTo(0.6, 5);
      expect(stats.averageMoisture).toBeCloseTo(0.5, 5);
    });
  });

  describe('getChunkBiomeStats', () => {
    it('counts tiles by biome', async () => {
      await flushPromises();
      const tiles = [
        createWorldTile({ biomeName: 'Plains' }),
        createWorldTile({ biomeName: 'Plains' }),
        createWorldTile({ biomeName: 'Forest' }),
      ];
      chunkGenerator.generateChunk.mockReturnValueOnce(
        createChunkData({ chunkX: 0, chunkY: 0, tiles }),
      );

      const stats = await service.getChunkBiomeStats(0, 0);

      expect(stats).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ biomeName: 'Plains', count: 2 }),
          expect.objectContaining({ biomeName: 'Forest', count: 1 }),
        ]),
      );
    });

    it('skips tiles missing biome names', async () => {
      await flushPromises();
      const tiles = [
        createWorldTile({ biomeName: '' }),
        createWorldTile({ biomeName: 'Desert' }),
      ];
      chunkGenerator.generateChunk.mockReturnValueOnce(
        createChunkData({ chunkX: 0, chunkY: 0, tiles }),
      );

      const stats = await service.getChunkBiomeStats(0, 0);

      expect(stats).toHaveLength(1);
      expect(stats[0].biomeName).toBe('Desert');
    });
  });

  describe('error handling', () => {
    it('bubbles up chunk generation failures', async () => {
      await flushPromises();
      chunkGenerator.generateChunk.mockImplementation(() => {
        throw new Error('Generation failed');
      });

      await expect(service.getChunk(0, 0)).rejects.toThrow('Generation failed');
    });

    it('logs initialization failures but leaves service usable', async () => {
      const failingDb = {
        ...worldDatabase,
        initializeBiomes: jest.fn(() =>
          Promise.reject(new Error('DB init failed')),
        ),
        loadWorldSeed: jest.fn(() => Promise.resolve(0)),
      } as unknown as WorldDatabaseService;

      const altService = new WorldService(
        failingDb,
        chunkGenerator as unknown as ChunkGeneratorService,
        tileService as unknown as TileService,
      );

      await flushPromises();

      expect(altService.getCurrentSeed()).toBe(0);
    });
  });
});
