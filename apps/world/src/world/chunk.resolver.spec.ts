import { ChunkResolver } from './chunk.resolver';

describe('ChunkResolver', () => {
  let resolver: ChunkResolver;
  let worldService: any;

  beforeEach(() => {
    worldService = {
      getChunkTiles: jest.fn(),
      getChunkTileCount: jest.fn(),
      getChunkSettlements: jest.fn(),
      getChunkStats: jest.fn(),
      getChunkBiomeStats: jest.fn(),
    };

    resolver = new ChunkResolver(worldService);
  });

  describe('getChunk', () => {
    it('should return basic chunk info', () => {
      const result = resolver.getChunk(5, 10);

      expect(result).toEqual({
        chunkX: 5,
        chunkY: 10,
      });
    });

    it('should handle negative coordinates', () => {
      const result = resolver.getChunk(-3, -7);

      expect(result).toEqual({
        chunkX: -3,
        chunkY: -7,
      });
    });

    it('should handle zero coordinates', () => {
      const result = resolver.getChunk(0, 0);

      expect(result).toEqual({
        chunkX: 0,
        chunkY: 0,
      });
    });
  });

  describe('tiles', () => {
    it('should resolve tiles for chunk', async () => {
      const mockTiles = [
        { id: 1, x: 0, y: 0, biomeId: 1, biomeName: 'Forest' },
        { id: 2, x: 1, y: 0, biomeId: 2, biomeName: 'Plains' },
      ];
      worldService.getChunkTiles.mockResolvedValue(mockTiles);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.tiles(chunk);

      expect(result).toEqual(mockTiles);
      expect(worldService.getChunkTiles).toHaveBeenCalledWith(0, 0);
    });

    it('should handle different chunk coordinates', async () => {
      worldService.getChunkTiles.mockResolvedValue([]);

      const chunk = { chunkX: 5, chunkY: 10 };
      await resolver.tiles(chunk);

      expect(worldService.getChunkTiles).toHaveBeenCalledWith(5, 10);
    });
  });

  describe('paginatedTiles', () => {
    it('should resolve paginated tiles with defaults', async () => {
      const mockTiles = [{ id: 1, x: 0, y: 0 }];
      worldService.getChunkTiles.mockResolvedValue(mockTiles);
      worldService.getChunkTileCount.mockResolvedValue(250);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.paginatedTiles(chunk);

      expect(result).toEqual({
        tiles: mockTiles,
        totalCount: 250,
        offset: 0,
        limit: 100,
        hasMore: true,
      });
      expect(worldService.getChunkTiles).toHaveBeenCalledWith(0, 0, 100, 0);
      expect(worldService.getChunkTileCount).toHaveBeenCalledWith(0, 0);
    });

    it('should use provided limit and offset', async () => {
      const mockTiles = [{ id: 1, x: 0, y: 0 }];
      worldService.getChunkTiles.mockResolvedValue(mockTiles);
      worldService.getChunkTileCount.mockResolvedValue(250);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.paginatedTiles(chunk, 50, 100);

      expect(result.limit).toBe(50);
      expect(result.offset).toBe(100);
      expect(worldService.getChunkTiles).toHaveBeenCalledWith(0, 0, 50, 100);
    });

    it('should calculate hasMore correctly when more items exist', async () => {
      worldService.getChunkTiles.mockResolvedValue([]);
      worldService.getChunkTileCount.mockResolvedValue(250);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.paginatedTiles(chunk, 50, 0);

      expect(result.hasMore).toBe(true);
    });

    it('should calculate hasMore correctly when no more items exist', async () => {
      worldService.getChunkTiles.mockResolvedValue([]);
      worldService.getChunkTileCount.mockResolvedValue(50);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.paginatedTiles(chunk, 50, 0);

      expect(result.hasMore).toBe(false);
    });

    it('should handle last page correctly', async () => {
      worldService.getChunkTiles.mockResolvedValue([]);
      worldService.getChunkTileCount.mockResolvedValue(250);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.paginatedTiles(chunk, 100, 200);

      expect(result.hasMore).toBe(false);
    });
  });

  describe('settlements', () => {
    it('should resolve settlements for chunk', async () => {
      const mockSettlements = [
        {
          id: 1,
          name: 'Test City',
          x: 5,
          y: 10,
          type: 'city',
          size: 'large',
          population: 10000,
        },
      ];
      worldService.getChunkSettlements.mockResolvedValue(mockSettlements);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.settlements(chunk);

      expect(result).toEqual(mockSettlements);
      expect(worldService.getChunkSettlements).toHaveBeenCalledWith(0, 0);
    });

    it('should handle empty settlements', async () => {
      worldService.getChunkSettlements.mockResolvedValue([]);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.settlements(chunk);

      expect(result).toEqual([]);
    });
  });

  describe('stats', () => {
    it('should resolve chunk stats', async () => {
      const mockStats = {
        averageHeight: 0.5,
        averageTemperature: 0.6,
        averageMoisture: 0.4,
      };
      worldService.getChunkStats.mockResolvedValue(mockStats);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.stats(chunk);

      expect(result).toEqual(mockStats);
      expect(worldService.getChunkStats).toHaveBeenCalledWith(0, 0);
    });
  });

  describe('biomeStats', () => {
    it('should resolve biome statistics', async () => {
      const mockBiomeStats = [
        { biomeName: 'Forest', count: 150 },
        { biomeName: 'Plains', count: 100 },
      ];
      worldService.getChunkBiomeStats.mockResolvedValue(mockBiomeStats);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.biomeStats(chunk);

      expect(result).toEqual(mockBiomeStats);
      expect(worldService.getChunkBiomeStats).toHaveBeenCalledWith(0, 0);
    });

    it('should handle empty biome stats', async () => {
      worldService.getChunkBiomeStats.mockResolvedValue([]);

      const chunk = { chunkX: 0, chunkY: 0 };
      const result = await resolver.biomeStats(chunk);

      expect(result).toEqual([]);
    });
  });
});
