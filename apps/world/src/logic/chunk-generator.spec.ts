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
});
