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

type WorldServiceMock = Pick<WorldService, 'getCurrentSeed'>;

describe('RenderService', () => {
  let service: RenderService;
  let mockWorldService: jest.Mocked<WorldServiceMock>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorldService = {
      getCurrentSeed: jest.fn<ReturnType<WorldService['getCurrentSeed']>, []>(
        () => 12345,
      ),
    };

    service = new RenderService(mockWorldService as unknown as WorldService);
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
      const canvas = await service.renderMap(0, 10, 0, 10, 4);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should handle different pixel sizes', async () => {
      const canvas = await service.renderMap(0, 10, 0, 10, 8);

      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should floor pixel size to minimum of 1', async () => {
      const canvas = await service.renderMap(0, 10, 0, 10, 0.5);

      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should handle negative coordinates', async () => {
      const canvas = await service.renderMap(-10, 0, -10, 0, 4);

      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });
  });

  describe('renderMapIsometric', () => {
    it('should render isometric map region', async () => {
      const canvas = await service.renderMapIsometric(0, 5, 0, 5, 4);

      expect(canvas).toBeDefined();
      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle single tile regions', async () => {
      const canvas = await service.renderMap(0, 1, 0, 1, 4);

      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should handle very large regions', async () => {
      const canvas = await service.renderMap(0, 100, 0, 100, 1);

      expect(canvas.width).toBeGreaterThan(0);
      expect(canvas.height).toBeGreaterThan(0);
    });

    it('should handle empty regions gracefully', async () => {
      // Coordinates where maxX <= minX result in 0-dimension canvas
      const canvas = await service.renderMap(10, 10, 10, 10, 4);

      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });
  });
});
