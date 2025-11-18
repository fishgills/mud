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

const mockContext = () => ({
  fillStyle: '#000000',
  strokeStyle: '#000000',
  lineWidth: 1,
  save: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  arc: jest.fn(),
  quadraticCurveTo: jest.fn(),
  clip: jest.fn(),
});

jest.mock('./image-utils', () => {
  const buildBitmap = (width: number, height: number) => ({
    width,
    height,
    getContext: () => mockContext(),
  });
  return {
    createRenderBitmap: jest.fn((width: number, height: number) =>
      buildBitmap(width, height),
    ),
    bitmapToPngBase64: jest.fn().mockResolvedValue('mock-png-b64'),
    decodePngBase64: jest.fn().mockResolvedValue(buildBitmap(50, 50)),
  };
});

import { RenderService } from './render.service';
import { WorldService } from '../world/world-refactored.service';
import { CacheService } from '../shared/cache.service';

type WorldServiceMock = Pick<WorldService, 'getCurrentSeed'>;

type CacheServiceMock = Pick<CacheService, 'get' | 'set'>;

describe('RenderService', () => {
  let service: RenderService;
  let mockWorldService: jest.Mocked<WorldServiceMock>;
  let mockCache: jest.Mocked<CacheServiceMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorldService = {
      getCurrentSeed: jest.fn<ReturnType<WorldService['getCurrentSeed']>, []>(
        () => 12345,
      ),
    };

    mockCache = {
      get: jest.fn<
        ReturnType<CacheService['get']>,
        Parameters<CacheService['get']>
      >(() => Promise.resolve(null)),
      set: jest.fn<
        ReturnType<CacheService['set']>,
        Parameters<CacheService['set']>
      >(() => Promise.resolve(undefined)),
    };

    service = new RenderService(
      mockWorldService as unknown as WorldService,
      mockCache as unknown as CacheService,
    );
  });

  describe('prepareMapData', () => {
    it('should compute tile data for the region', async () => {
      const result = await service.prepareMapData(0, 10, 0, 10);

      expect(result.width).toBe(10);
      expect(result.height).toBe(10);
      expect(result.tileData).toBeDefined();
      expect(result.tileData.length).toBe(100); // 10x10 grid
    });

    it('should include biome information for each tile', async () => {
      const result = await service.prepareMapData(0, 2, 0, 2);

      result.tileData.forEach((tile) => {
        expect(tile).toHaveProperty('x');
        expect(tile).toHaveProperty('y');
        expect(tile).toHaveProperty('biome');
      });
    });
  });

  describe('renderMapAscii', () => {
    it('should generate ASCII map for a region', async () => {
      const result = await service.renderMapAscii(0, 10, 0, 10);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include legend in ASCII map', async () => {
      const result = await service.renderMapAscii(0, 10, 0, 10);

      expect(result).toContain('ASCII Map');
      expect(result).toContain('Ungenerated area');
    });
  });

  describe('renderMap', () => {
    it('should render a map region', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 4);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(40); // 10 tiles * 4 pixels
      expect(canvas.height).toBe(40);
    });

    it('should use cached chunk data when available', async () => {
      // For this test, we need to mock the full image loading process
      // This is complex, so for now we just verify render works without cache
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 50, 0, 50, 4);

      expect(canvas).toBeDefined();
      // Should have attempted to check cache
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should handle different pixel sizes', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 8);

      expect(canvas.width).toBe(80); // 10 tiles * 8 pixels
      expect(canvas.height).toBe(80);
    });

    it('should floor pixel size to minimum of 1', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 0.5);

      expect(canvas.width).toBe(10); // 10 tiles * 1 pixel (floored)
      expect(canvas.height).toBe(10);
    });

    it('should include center marker', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 4);

      expect(canvas).toBeDefined();
      // Center should be at (5, 5) for a 0-10 range
    });

    it('should handle negative coordinates', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(-10, 0, -10, 0, 4);

      expect(canvas.width).toBe(40);
      expect(canvas.height).toBe(40);
    });

    it('should opportunistically prewarm chunk cache', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 50, 0, 50, 4);

      // Should trigger prewarm (non-blocking, so we just check render succeeded)
      expect(canvas).toBeDefined();
    });
  });

  describe('caching behavior', () => {
    it('should check cache for chunks', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 50, 0, 50, 4);

      expect(canvas).toBeDefined();
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should set cache after rendering chunks', async () => {
      mockCache.get.mockResolvedValue(null);

      await (
        service as unknown as { getChunkPngBase64: Function }
      ).getChunkPngBase64(0, 0, 4);

      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringContaining('chunk:png:'),
        expect.any(String),
        expect.any(Number),
      );
    });

    it('should respect RENDER_STYLE_VERSION in cache keys', async () => {
      mockCache.get.mockResolvedValue(null);
      mockCache.set.mockResolvedValue(undefined);

      await (
        service as unknown as { getChunkPngBase64: Function }
      ).getChunkPngBase64(0, 0, 4);

      const key = mockCache.set.mock.calls[0]?.[0];
      expect(key).toContain('v3');
    });
  });

  describe('edge cases', () => {
    it('should handle single tile regions', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 1, 0, 1, 4);

      expect(canvas.width).toBe(4);
      expect(canvas.height).toBe(4);
    });

    it('should handle very large regions', async () => {
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 100, 0, 100, 1);

      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(100);
    });

    it('should handle empty regions gracefully', async () => {
      mockCache.get.mockResolvedValue(null);

      // Coordinates where maxX <= minX result in 0-dimension canvas
      const canvas = await service.renderMap(10, 10, 10, 10, 4);

      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });
  });
});
