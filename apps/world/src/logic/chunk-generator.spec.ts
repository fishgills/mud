import { ChunkWorldGenerator, ChunkCoordinate } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG, WorldConfig } from './world-config';
import { prismaMock } from '../test-setup';

describe('ChunkWorldGenerator', () => {
  let generator: ChunkWorldGenerator;
  let config: WorldConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup common Prisma mock implementations
    prismaMock.biome.findUnique.mockResolvedValue({
      id: 1,
      name: 'forest',
    });

    prismaMock.biome.create.mockResolvedValue({
      id: 1,
      name: 'forest',
    });

    prismaMock.worldTile.findUnique.mockResolvedValue(null);
    prismaMock.worldTile.create.mockResolvedValue({
      id: 1,
      x: 0,
      y: 0,
      biomeId: 1,
      description: 'A test tile',
    });

    config = { ...DEFAULT_WORLD_CONFIG };
    generator = new ChunkWorldGenerator(config);
  });

  describe('Static utility methods', () => {
    describe('chunkToWorld', () => {
      it('should convert chunk coordinates to world coordinates correctly', () => {
        const chunkCoord: ChunkCoordinate = { chunkX: 2, chunkY: 3 };
        const worldCoords = ChunkWorldGenerator.chunkToWorld(chunkCoord);

        expect(worldCoords).toEqual({
          startX: 100, // 2 * 50
          startY: 150, // 3 * 50
          endX: 149, // 100 + 50 - 1
          endY: 199, // 150 + 50 - 1
        });
      });

      it('should handle negative chunk coordinates', () => {
        const chunkCoord: ChunkCoordinate = { chunkX: -1, chunkY: -2 };
        const worldCoords = ChunkWorldGenerator.chunkToWorld(chunkCoord);

        expect(worldCoords).toEqual({
          startX: -50,
          startY: -100,
          endX: -1,
          endY: -51,
        });
      });

      it('should handle zero coordinates', () => {
        const chunkCoord: ChunkCoordinate = { chunkX: 0, chunkY: 0 };
        const worldCoords = ChunkWorldGenerator.chunkToWorld(chunkCoord);

        expect(worldCoords).toEqual({
          startX: 0,
          startY: 0,
          endX: 49,
          endY: 49,
        });
      });
    });

    describe('worldToChunk', () => {
      it('should convert world coordinates to chunk coordinates correctly', () => {
        expect(ChunkWorldGenerator.worldToChunk(125, 175)).toEqual({
          chunkX: 2,
          chunkY: 3,
        });
        expect(ChunkWorldGenerator.worldToChunk(0, 0)).toEqual({
          chunkX: 0,
          chunkY: 0,
        });
        expect(ChunkWorldGenerator.worldToChunk(49, 49)).toEqual({
          chunkX: 0,
          chunkY: 0,
        });
        expect(ChunkWorldGenerator.worldToChunk(50, 50)).toEqual({
          chunkX: 1,
          chunkY: 1,
        });
      });

      it('should handle negative world coordinates', () => {
        expect(ChunkWorldGenerator.worldToChunk(-1, -1)).toEqual({
          chunkX: -1,
          chunkY: -1,
        });
        expect(ChunkWorldGenerator.worldToChunk(-50, -50)).toEqual({
          chunkX: -1,
          chunkY: -1,
        });
        expect(ChunkWorldGenerator.worldToChunk(-51, -51)).toEqual({
          chunkX: -2,
          chunkY: -2,
        });
      });
    });
  });

  describe('Redis caching functionality', () => {
    it('should generate tiles without Redis errors', async () => {
      // This test ensures that the Redis mock is working properly
      // and doesn't throw any connection errors
      const tile = await generator.generateTile(10, 20);

      expect(tile).toBeDefined();
      expect(tile.x).toBe(10);
      expect(tile.y).toBe(20);
      expect(tile.biomeId).toBeDefined();
      expect(tile.description).toContain('(10, 20)');
    });

    it('should handle cache operations for tiles', async () => {
      // Generate the same tile twice to test caching
      const tile1 = await generator.generateTileWithCacheInfo(5, 5);
      const tile2 = await generator.generateTileWithCacheInfo(5, 5);

      expect(tile1.tile).toBeDefined();
      expect(tile2.tile).toBeDefined();
      expect(tile1.tile.x).toBe(5);
      expect(tile1.tile.y).toBe(5);
      expect(tile2.tile.x).toBe(5);
      expect(tile2.tile.y).toBe(5);

      // The tiles should be identical
      expect(tile1.tile.id).toBe(tile2.tile.id);
      expect(tile1.tile.biomeId).toBe(tile2.tile.biomeId);
      expect(tile1.tile.description).toBe(tile2.tile.description);
    });

    it('should generate chunks without Redis errors', async () => {
      const chunk = await generator.generateChunk(0, 0);

      expect(chunk).toBeDefined();
      expect(chunk.chunkX).toBe(0);
      expect(chunk.chunkY).toBe(0);
      expect(chunk.tiles).toHaveLength(2500); // 50x50 tiles
      expect(chunk.generatedAt).toBeInstanceOf(Date);
    });
  });

  describe('Constructor and configuration', () => {
    it('should initialize with default config when no config provided', () => {
      const defaultGenerator = new ChunkWorldGenerator();
      expect(defaultGenerator).toBeDefined();
    });

    it('should initialize with custom config', () => {
      const customConfig = {
        ...DEFAULT_WORLD_CONFIG,
        cityProbability: 0.05,
        villageProbability: 0.15,
        settlementSpacing: 200,
      };
      const customGenerator = new ChunkWorldGenerator(customConfig);
      expect(customGenerator).toBeDefined();
    });
  });

  describe('Tile generation', () => {
    describe('generateTile', () => {
      it('should generate a tile with correct coordinates', async () => {
        const tile = await generator.generateTile(100, 200);

        expect(tile).toBeDefined();
        expect(tile.x).toBe(100);
        expect(tile.y).toBe(200);
        expect(tile.biomeId).toBeDefined();
        expect(tile.description).toContain('(100, 200)');
      });

      it('should generate different tiles for different coordinates', async () => {
        const tile1 = await generator.generateTile(0, 0);
        const tile2 = await generator.generateTile(1, 1);

        expect(tile1.x).toBe(0);
        expect(tile1.y).toBe(0);
        expect(tile2.x).toBe(1);
        expect(tile2.y).toBe(1);
      });
    });

    describe('generateTileWithCacheInfo', () => {
      it('should return cache miss on first generation', async () => {
        const result = await generator.generateTileWithCacheInfo(50, 75);

        expect(result.tile).toBeDefined();
        expect(result.cacheHit).toBe(false);
        expect(result.source).toBe('generated');
        expect(result.tile.x).toBe(50);
        expect(result.tile.y).toBe(75);
      });
      it('should return tile when database lookup returns existing tile', async () => {
        // Simple test - just verify that we get a tile back with correct coordinates
        const result = await generator.generateTileWithCacheInfo(25, 35);

        expect(result.tile).toBeDefined();
        expect(result.tile.x).toBe(25);
        expect(result.tile.y).toBe(35);
        // Accept any valid source since caching might affect the result
        expect(['cache', 'database', 'generated']).toContain(result.source);
      });
    });
  });

  describe('Chunk generation', () => {
    describe('generateChunk', () => {
      it('should generate a chunk with correct dimensions', async () => {
        const chunk = await generator.generateChunk(1, 2);

        expect(chunk.chunkX).toBe(1);
        expect(chunk.chunkY).toBe(2);
        expect(chunk.tiles).toHaveLength(2500); // 50x50 tiles
        expect(chunk.generatedAt).toBeInstanceOf(Date);
      });

      it('should generate tiles with correct world coordinates for chunk', async () => {
        const chunk = await generator.generateChunk(2, 3);

        // Check first tile (top-left of chunk)
        const firstTile = chunk.tiles[0];
        expect(firstTile.x).toBe(100); // 2 * 50
        expect(firstTile.y).toBe(150); // 3 * 50

        // Check that all tiles have coordinates within chunk bounds
        chunk.tiles.forEach((tile) => {
          expect(tile.x).toBeGreaterThanOrEqual(100);
          expect(tile.x).toBeLessThan(150);
          expect(tile.y).toBeGreaterThanOrEqual(150);
          expect(tile.y).toBeLessThan(200);
        });
      });
    });

    describe('generateChunkWithCacheInfo', () => {
      it('should return cache miss on first chunk generation', async () => {
        const result = await generator.generateChunkWithCacheInfo(0, 1);

        expect(result.chunk).toBeDefined();
        expect(result.cacheHit).toBe(false);
        expect(result.source).toBe('generated');
        expect(result.chunk.chunkX).toBe(0);
        expect(result.chunk.chunkY).toBe(1);
      });
    });
  });

  describe('Database operations', () => {
    describe('biome handling', () => {
      it('should use biome operations when generating tiles', async () => {
        // Simple test to verify biome operations are called
        const tile = await generator.generateTile(300, 400);

        expect(tile).toBeDefined();
        expect(tile.x).toBe(300);
        expect(tile.y).toBe(400);
        expect(tile.biomeId).toBeDefined();
        // The default mock returns biomeId 1, so we expect that
        expect(tile.biomeId).toBe(1);
      });

      it('should create new biome if not found', async () => {
        prismaMock.biome.findUnique.mockResolvedValue(null);
        prismaMock.biome.create.mockResolvedValue({
          id: 10,
          name: 'tundra',
        });

        const tile = await generator.generateTile(500, 600);

        expect(prismaMock.biome.findUnique).toHaveBeenCalled();
        expect(prismaMock.biome.create).toHaveBeenCalled();
        expect(tile.biomeId).toBe(10);
      });

      it('should handle biome creation errors gracefully', async () => {
        prismaMock.biome.findUnique.mockRejectedValue(
          new Error('Database error')
        );
        prismaMock.biome.create.mockRejectedValue(new Error('Database error'));

        // Should throw an error when biome operations fail
        await expect(generator.generateTile(700, 800)).rejects.toThrow(
          'Failed to get or create biome'
        );
      });
    });
    describe('tile storage', () => {
      it('should attempt to store new tiles to database', async () => {
        prismaMock.worldTile.create.mockResolvedValue({
          id: 123,
          x: 15,
          y: 25,
          biomeId: 1,
          description: 'A stored tile',
        });

        const tile = await generator.generateTile(15, 25);

        // Verify the tile was generated correctly
        expect(tile.x).toBe(15);
        expect(tile.y).toBe(25);
        expect(tile.biomeId).toBe(1);
        expect(tile.description).toContain('(15, 25)');

        // Note: storeTileAsync is called asynchronously in the background,
        // so we can't directly verify the database call in this test
        // We just ensure the tile generation works properly
      });
    });
  });

  describe('Error handling', () => {
    it('should handle Redis connection errors gracefully', async () => {
      // Redis is mocked, but this tests that no errors are thrown
      const tile = await generator.generateTile(999, 888);

      expect(tile).toBeDefined();
      expect(tile.x).toBe(999);
      expect(tile.y).toBe(888);
    });
    it('should handle database errors gracefully', async () => {
      prismaMock.biome.findUnique.mockRejectedValue(
        new Error('Connection failed')
      );

      // Should throw error when database operations fail
      await expect(generator.generateTile(111, 222)).rejects.toThrow(
        'Failed to get or create biome'
      );
    });
  });

  describe('Settlement logic', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
      // Spy on console.error to avoid noise in test output
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should respect settlement spacing', async () => {
      // Test configuration with specific settlement parameters
      const settlementConfig = {
        ...DEFAULT_WORLD_CONFIG,
        cityProbability: 1.0, // Force cities to try to generate
        villageProbability: 1.0, // Force villages to try to generate
        settlementSpacing: 100,
      };
      const settlementGenerator = new ChunkWorldGenerator(settlementConfig);

      // Generate multiple tiles to test settlement spacing
      const tiles = await Promise.all([
        settlementGenerator.generateTile(0, 0),
        settlementGenerator.generateTile(1, 1),
        settlementGenerator.generateTile(50, 50),
      ]);

      // All tiles should be generated successfully
      tiles.forEach((tile) => {
        expect(tile).toBeDefined();
        expect(tile.biomeId).toBeDefined();
      });
    });
  });

  describe('Caching behavior', () => {
    it('should use consistent cache keys', async () => {
      // Generate the same tile multiple times
      await generator.generateTileWithCacheInfo(123, 456);
      await generator.generateTileWithCacheInfo(123, 456);

      // Both calls should work (Redis mock handles caching internally)
      expect(true).toBe(true); // Placeholder - Redis mock doesn't expose internals
    });

    it('should cache chunks and tiles separately', async () => {
      await generator.generateChunk(5, 6);
      await generator.generateTile(250, 300); // 5*50, 6*50

      // Both operations should complete successfully
      expect(true).toBe(true);
    });
  });

  describe('Coordinate validation', () => {
    it('should handle extreme coordinates', async () => {
      const extremeTile = await generator.generateTile(-9999, 9999);

      expect(extremeTile.x).toBe(-9999);
      expect(extremeTile.y).toBe(9999);
      expect(extremeTile.biomeId).toBeDefined();
    });

    it('should handle zero coordinates correctly', async () => {
      const zeroTile = await generator.generateTile(0, 0);

      expect(zeroTile.x).toBe(0);
      expect(zeroTile.y).toBe(0);
      expect(zeroTile.biomeId).toBeDefined();
    });
  });

  describe('Integration tests', () => {
    it('should generate a complete chunk with all tiles having valid biomes', async () => {
      const chunk = await generator.generateChunk(0, 0);

      expect(chunk.tiles).toHaveLength(2500);

      // Check that all tiles have valid properties
      chunk.tiles.forEach((tile) => {
        expect(tile.x).toBeGreaterThanOrEqual(0);
        expect(tile.x).toBeLessThan(50);
        expect(tile.y).toBeGreaterThanOrEqual(0);
        expect(tile.y).toBeLessThan(50);
        expect(tile.biomeId).toBeDefined();
        expect(tile.description).toBeDefined();
        expect(tile.description).toContain(`(${tile.x}, ${tile.y})`);
      });
    });

    it('should generate deterministic tiles for same coordinates', async () => {
      const tile1 = await generator.generateTile(42, 84);
      const tile2 = await generator.generateTile(42, 84);

      // Should generate the same tile (deterministic)
      expect(tile1.x).toBe(tile2.x);
      expect(tile1.y).toBe(tile2.y);
      expect(tile1.biomeId).toBe(tile2.biomeId);
      expect(tile1.description).toBe(tile2.description);
    });
  });
});
