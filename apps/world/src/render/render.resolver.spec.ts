// Mock env module before other imports
jest.mock('../env', () => ({
  env: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    CACHE_PREFIX: 'test:',
    WORLD_RENDER_CACHE_TTL_MS: 30000,
    WORLD_RENDER_COMPUTE_ON_THE_FLY: true,
  },
}));

import { RenderResolver } from './render.resolver';

describe('RenderResolver', () => {
  let resolver: RenderResolver;
  let renderService: any;
  let cacheService: any;

  beforeEach(() => {
    renderService = {
      prepareMapData: jest.fn(),
      renderMapAscii: jest.fn(),
      renderMap: jest.fn(),
    };

    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      clearAll: jest.fn(),
      clearPattern: jest.fn(),
    };

    resolver = new RenderResolver(renderService, cacheService);
  });

  describe('renderMapTiles', () => {
    it('should return 2D array of map tiles with default center', async () => {
      const mockTileData = [
        {
          x: -25,
          y: -25,
          biome: { name: 'Forest', ascii: '♣' },
          settlement: null,
        },
        {
          x: -24,
          y: -25,
          biome: { name: 'Plains', ascii: '~' },
          settlement: null,
        },
      ];

      renderService.prepareMapData.mockResolvedValue({
        tileData: mockTileData,
        width: 50,
        height: 50,
      });

      const result = await resolver.renderMapTiles();

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(50); // 50 rows
      expect(result[0].length).toBe(50); // 50 columns per row
      expect(renderService.prepareMapData).toHaveBeenCalledWith(
        -25,
        25,
        -25,
        25,
      );
    });

    it('should use provided x and y coordinates', async () => {
      renderService.prepareMapData.mockResolvedValue({
        tileData: [],
        width: 50,
        height: 50,
      });

      await resolver.renderMapTiles(100, 200);

      expect(renderService.prepareMapData).toHaveBeenCalledWith(
        75,
        125,
        175,
        225,
      );
    });

    it('should handle negative coordinates', async () => {
      renderService.prepareMapData.mockResolvedValue({
        tileData: [],
        width: 50,
        height: 50,
      });

      await resolver.renderMapTiles(-50, -100);

      expect(renderService.prepareMapData).toHaveBeenCalledWith(
        -75,
        -25,
        -125,
        -75,
      );
    });

    it('should map tile data to MapTile objects', async () => {
      const mockTileData = [
        {
          x: 0,
          y: 0,
          biome: { name: 'Forest', ascii: '♣' },
          settlement: null,
        },
      ];

      renderService.prepareMapData.mockResolvedValue({
        tileData: mockTileData,
        width: 50,
        height: 50,
      });

      const result = await resolver.renderMapTiles(25, 25);

      // Result is indexed by [y-index][x-index] starting from minY/minX
      // Center at (25,25), range is (0,50) x (0,50)
      // Tile at world coords (0,0) is at array index [0][0]
      const tile = result[0][0];
      expect(tile).toBeDefined();
      expect(tile.x).toBe(0); // World coordinate
      expect(tile.y).toBe(0); // World coordinate
      expect(tile.biomeName).toBe('Forest');
      expect(tile.symbol).toBe('♣');
      expect(tile.hasSettlement).toBe(false);
    });

    it('should mark settlement tiles correctly', async () => {
      const mockTileData = [
        {
          x: 10,
          y: 20,
          biome: { name: 'Plains', ascii: '~' },
          settlement: { x: 10, y: 20, name: 'Test City' },
        },
      ];

      renderService.prepareMapData.mockResolvedValue({
        tileData: mockTileData,
        width: 50,
        height: 50,
      });

      const result = await resolver.renderMapTiles(35, 45);

      // Center at (35,45), range is (10,20) to (60,70)
      // Tile at world (10,20) is at array index [0][0]
      const settlementTile = result[0][0];
      expect(settlementTile.hasSettlement).toBe(true);
      expect(settlementTile.isSettlementCenter).toBe(true);
    });

    it('should handle tiles with settlement but not center', async () => {
      const mockTileData = [
        {
          x: 10,
          y: 20,
          biome: { name: 'Plains', ascii: '~' },
          settlement: { x: 5, y: 15, name: 'Test City' }, // Settlement center elsewhere
        },
      ];

      renderService.prepareMapData.mockResolvedValue({
        tileData: mockTileData,
        width: 50,
        height: 50,
      });

      const result = await resolver.renderMapTiles(35, 45);

      // Center at (35,45), range is (10,20) to (60,70)
      // Tile at world (10,20) is at array index [0][0]
      const settlementTile = result[0][0];
      expect(settlementTile.hasSettlement).toBe(true);
      expect(settlementTile.isSettlementCenter).toBe(false);
    });

    it('should handle missing tile data gracefully', async () => {
      renderService.prepareMapData.mockResolvedValue({
        tileData: [], // No tile data
        width: 50,
        height: 50,
      });

      const result = await resolver.renderMapTiles();

      expect(result.length).toBe(50);
      expect(result[0][0].biomeName).toBeUndefined();
      expect(result[0][0].symbol).toBeUndefined();
    });

    it('should handle missing biome data', async () => {
      const mockTileData = [
        {
          x: 0,
          y: 0,
          biome: null,
          settlement: null,
        },
      ];

      renderService.prepareMapData.mockResolvedValue({
        tileData: mockTileData,
        width: 50,
        height: 50,
      });

      const result = await resolver.renderMapTiles(25, 25);

      const centerTile = result[25][25];
      expect(centerTile.biomeName).toBeUndefined();
      expect(centerTile.symbol).toBeUndefined();
    });
  });

  describe('renderMapAscii', () => {
    it('should return ASCII map with default center', async () => {
      renderService.renderMapAscii.mockResolvedValue('ASCII map content');

      const result = await resolver.renderMapAscii();

      expect(result).toBe('ASCII map content');
      expect(renderService.renderMapAscii).toHaveBeenCalledWith(
        -25,
        25,
        -25,
        25,
      );
    });

    it('should use provided coordinates', async () => {
      renderService.renderMapAscii.mockResolvedValue('ASCII map');

      await resolver.renderMapAscii(50, 100);

      expect(renderService.renderMapAscii).toHaveBeenCalledWith(
        25,
        75,
        75,
        125,
      );
    });

    it('should handle negative coordinates', async () => {
      renderService.renderMapAscii.mockResolvedValue('ASCII map');

      await resolver.renderMapAscii(-100, -200);

      expect(renderService.renderMapAscii).toHaveBeenCalledWith(
        -125,
        -75,
        -225,
        -175,
      );
    });

    it('should return string result from service', async () => {
      const mockAscii = '# Test ASCII Map\n~~~\n♣♣♣';
      renderService.renderMapAscii.mockResolvedValue(mockAscii);

      const result = await resolver.renderMapAscii(10, 20);

      expect(typeof result).toBe('string');
      expect(result).toBe(mockAscii);
    });
  });

  describe('renderMapPngBase64', () => {
    const mockCanvas = {
      toBuffer: jest.fn().mockReturnValue(Buffer.from('fake-png-data')),
    };

    beforeEach(() => {
      renderService.renderMap.mockResolvedValue(mockCanvas);
    });

    it('should return base64 PNG with default parameters', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await resolver.renderMapPngBase64();

      expect(typeof result).toBe('string');
      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
      expect(cacheService.set).toHaveBeenCalled();
    });

    it('should use provided coordinates and pixelsPerTile', async () => {
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64(50, 100, 8);

      expect(renderService.renderMap).toHaveBeenCalledWith(25, 75, 75, 125, 8);
    });

    it('should return cached result when available', async () => {
      const cachedBase64 = Buffer.from('cached-png').toString('base64');
      cacheService.get.mockResolvedValue(cachedBase64);

      const result = await resolver.renderMapPngBase64(10, 20, 4);

      expect(result).toBe(cachedBase64);
      expect(renderService.renderMap).not.toHaveBeenCalled();
      expect(cacheService.set).not.toHaveBeenCalled();
    });

    it('should cache rendered result', async () => {
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64(10, 20, 4);

      const expectedKey = '-15,-5,35,45,p=4';
      expect(cacheService.set).toHaveBeenCalledWith(
        expectedKey,
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should use default pixelsPerTile of 4', async () => {
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64(0, 0);

      expect(renderService.renderMap).toHaveBeenCalledWith(-25, 25, -25, 25, 4);
    });

    it('should handle different pixelsPerTile values', async () => {
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64(0, 0, 16);

      expect(renderService.renderMap).toHaveBeenCalledWith(
        -25,
        25,
        -25,
        25,
        16,
      );
    });

    it('should use WORLD_RENDER_CACHE_TTL_MS from env', async () => {
      process.env.WORLD_RENDER_CACHE_TTL_MS = '60000';
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64();

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        60000,
      );

      delete process.env.WORLD_RENDER_CACHE_TTL_MS;
    });

    it('should use default TTL when env var not set', async () => {
      delete process.env.WORLD_RENDER_CACHE_TTL_MS;
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64();

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        30000,
      );
    });

    it('should encode canvas as base64', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await resolver.renderMapPngBase64();

      expect(mockCanvas.toBuffer).toHaveBeenCalledWith('image/png');
      expect(typeof result).toBe('string');
    });

    it('should handle negative coordinates', async () => {
      cacheService.get.mockResolvedValue(null);

      await resolver.renderMapPngBase64(-100, -200, 4);

      expect(renderService.renderMap).toHaveBeenCalledWith(
        -125,
        -75,
        -225,
        -175,
        4,
      );
    });
  });

  describe('clearRenderCache', () => {
    it('should clear all cache when no pattern provided', async () => {
      cacheService.clearAll.mockResolvedValue(42);

      const result = await resolver.clearRenderCache();

      expect(result).toBe(42);
      expect(cacheService.clearAll).toHaveBeenCalled();
      expect(cacheService.clearPattern).not.toHaveBeenCalled();
    });

    it('should clear cache by pattern when provided', async () => {
      cacheService.clearPattern.mockResolvedValue(15);

      const result = await resolver.clearRenderCache('*,p=4');

      expect(result).toBe(15);
      expect(cacheService.clearPattern).toHaveBeenCalledWith('*,p=4');
      expect(cacheService.clearAll).not.toHaveBeenCalled();
    });

    it('should handle wildcard pattern', async () => {
      cacheService.clearPattern.mockResolvedValue(100);

      const result = await resolver.clearRenderCache('*');

      expect(result).toBe(100);
      expect(cacheService.clearPattern).toHaveBeenCalledWith('*');
    });

    it('should handle specific pattern', async () => {
      cacheService.clearPattern.mockResolvedValue(5);

      const result = await resolver.clearRenderCache('10,20,*');

      expect(result).toBe(5);
      expect(cacheService.clearPattern).toHaveBeenCalledWith('10,20,*');
    });

    it('should return number of cleared keys', async () => {
      cacheService.clearAll.mockResolvedValue(0);

      const result = await resolver.clearRenderCache();

      expect(typeof result).toBe('number');
      expect(result).toBe(0);
    });
  });
});
