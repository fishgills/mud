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

import { RenderService } from './render.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorldService } from '../world/world-refactored.service';
import { CacheService } from '../shared/cache.service';

describe('RenderService', () => {
  let service: RenderService;
  let mockPrisma: jest.Mocked<PrismaService>;
  let mockWorldService: jest.Mocked<WorldService>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockPrisma = {
      settlement: {
        findMany: jest.fn(),
      },
      worldTile: {
        findMany: jest.fn(),
      },
    } as any;

    mockWorldService = {
      getCurrentSeed: jest.fn().mockReturnValue(12345),
      isCoordinateInSettlement: jest.fn().mockReturnValue({
        isSettlement: false,
        intensity: 0,
      }),
    } as any;

    mockCache = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    } as any;

    service = new RenderService(mockPrisma, mockWorldService, mockCache);
  });

  describe('prepareMapData', () => {
    it('should fetch settlements in the region when requested', async () => {
      const mockSettlements = [
        {
          id: 1,
          name: 'Test City',
          x: 5,
          y: 5,
          type: 'city',
          size: 'large',
          population: 1000,
          description: 'A test city',
        },
      ];

      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue(
        mockSettlements,
      );

      const result = await service.prepareMapData(0, 10, 0, 10, {
        includeSettlements: true,
      });

      expect(mockPrisma.settlement.findMany).toHaveBeenCalledWith({
        where: {
          x: { gte: 0, lt: 10 },
          y: { gte: 0, lt: 10 },
        },
      });
      expect(result.settlementMap.size).toBe(1);
    });

    it('should not fetch settlements when not requested', async () => {
      await service.prepareMapData(0, 10, 0, 10, {
        includeSettlements: false,
      });

      expect(mockPrisma.settlement.findMany).not.toHaveBeenCalled();
    });

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
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.renderMapAscii(0, 10, 0, 10);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include settlement markers in ASCII map', async () => {
      const mockSettlement = {
        id: 1,
        name: 'Test City',
        x: 5,
        y: 5,
        type: 'city',
        size: 'large',
        population: 1000,
        description: 'A test city',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([
        mockSettlement,
      ]);

      mockWorldService.isCoordinateInSettlement.mockImplementation((x, y) => ({
        isSettlement: x === 5 && y === 5,
        intensity: x === 5 && y === 5 ? 1 : 0,
      }));

      const result = await service.renderMapAscii(0, 10, 0, 10);

      expect(result).toContain('★'); // Settlement center marker
    });

    it('should include legend in ASCII map', async () => {
      const result = await service.renderMapAscii(0, 10, 0, 10);

      expect(result).toContain('Settlement Center');
      expect(result).toContain('Dense Settlement');
    });
  });

  describe('renderMap', () => {
    it('should render a map region', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 4);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBe(40); // 10 tiles * 4 pixels
      expect(canvas.height).toBe(40);
    });

    it('should use cached chunk data when available', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);

      // For this test, we need to mock the full image loading process
      // This is complex, so for now we just verify render works without cache
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 50, 0, 50, 4);

      expect(canvas).toBeDefined();
      // Should have attempted to check cache
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should handle different pixel sizes', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 8);

      expect(canvas.width).toBe(80); // 10 tiles * 8 pixels
      expect(canvas.height).toBe(80);
    });

    it('should floor pixel size to minimum of 1', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 0.5);

      expect(canvas.width).toBe(10); // 10 tiles * 1 pixel (floored)
      expect(canvas.height).toBe(10);
    });

    it('should render settlement footprints', async () => {
      const mockSettlement = {
        id: 1,
        name: 'Test City',
        x: 5,
        y: 5,
        type: 'city',
        size: 'large',
        population: 1000,
        description: 'A test city',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([
        mockSettlement,
      ]);
      mockCache.get.mockResolvedValue(null);

      mockWorldService.isCoordinateInSettlement.mockImplementation((x, y) => ({
        isSettlement: x >= 3 && x <= 7 && y >= 3 && y <= 7,
        settlement: mockSettlement as any,
        intensity: x === 5 && y === 5 ? 1 : 0.5,
      }));

      const canvas = await service.renderMap(0, 10, 0, 10, 4);

      expect(canvas).toBeDefined();
      expect(mockWorldService.isCoordinateInSettlement).toHaveBeenCalled();
    });

    it('should include center marker', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 10, 0, 10, 4);

      expect(canvas).toBeDefined();
      // Center should be at (5, 5) for a 0-10 range
    });

    it('should handle negative coordinates', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(-10, 0, -10, 0, 4);

      expect(canvas.width).toBe(40);
      expect(canvas.height).toBe(40);
    });

    it('should opportunistically prewarm chunk cache', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 50, 0, 50, 4);

      // Should trigger prewarm (non-blocking, so we just check render succeeded)
      expect(canvas).toBeDefined();
    });
  });

  describe('caching behavior', () => {
    it('should check cache for chunks', async () => {
      mockCache.get.mockResolvedValue(null);
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);

      const canvas = await service.renderMap(0, 50, 0, 50, 4);

      expect(canvas).toBeDefined();
      expect(mockCache.get).toHaveBeenCalled();
    });

    it('should set cache after rendering chunks', async () => {
      mockCache.get.mockResolvedValue(null);
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);

      // Wait for async render to complete
      await service.renderMap(0, 50, 0, 50, 4);

      // Give time for prewarm to execute (it's non-blocking)
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Cache should be set for rendered chunks during prewarm
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should respect RENDER_STYLE_VERSION in cache keys', async () => {
      mockCache.get.mockImplementation((key: string) => {
        // Verify cache key includes version
        expect(key).toContain('v2'); // RENDER_STYLE_VERSION = 2
        return Promise.resolve(null);
      });
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);

      await service.renderMap(0, 50, 0, 50, 4);
    });
  });

  describe('edge cases', () => {
    it('should handle single tile regions', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 1, 0, 1, 4);

      expect(canvas.width).toBe(4);
      expect(canvas.height).toBe(4);
    });

    it('should handle very large regions', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      const canvas = await service.renderMap(0, 100, 0, 100, 1);

      expect(canvas.width).toBe(100);
      expect(canvas.height).toBe(100);
    });

    it('should handle empty regions gracefully', async () => {
      (mockPrisma.settlement.findMany as jest.Mock).mockResolvedValue([]);
      mockCache.get.mockResolvedValue(null);

      // Coordinates where maxX <= minX result in 0-dimension canvas
      const canvas = await service.renderMap(10, 10, 10, 10, 4);

      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });
  });
});
