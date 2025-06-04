import { ChunkWorldGenerator, ChunkCoordinate } from './chunk-generator';
import { DEFAULT_WORLD_CONFIG, WorldConfig } from './world-config';
import { getPrismaClient, PrismaClient } from '@mud/database';
// Import mocked instances

describe('ChunkWorldGenerator', () => {
  let generator: ChunkWorldGenerator;
  let config: WorldConfig;
  let prismaClient: PrismaClient;
  beforeEach(() => {
    jest.clearAllMocks();
    
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
          endX: 149,   // 100 + 50 - 1
          endY: 199,   // 150 + 50 - 1
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
        expect(ChunkWorldGenerator.worldToChunk(125, 175)).toEqual({ chunkX: 2, chunkY: 3 });
        expect(ChunkWorldGenerator.worldToChunk(0, 0)).toEqual({ chunkX: 0, chunkY: 0 });
        expect(ChunkWorldGenerator.worldToChunk(49, 49)).toEqual({ chunkX: 0, chunkY: 0 });
        expect(ChunkWorldGenerator.worldToChunk(50, 50)).toEqual({ chunkX: 1, chunkY: 1 });
      });

      it('should handle negative world coordinates', () => {
        expect(ChunkWorldGenerator.worldToChunk(-1, -1)).toEqual({ chunkX: -1, chunkY: -1 });
        expect(ChunkWorldGenerator.worldToChunk(-50, -50)).toEqual({ chunkX: -1, chunkY: -1 });
        expect(ChunkWorldGenerator.worldToChunk(-51, -51)).toEqual({ chunkX: -2, chunkY: -2 });
      });
    });
  });

  describe('generateTile', () => {
    it('should generate a tile with correct properties', async () => {
      const tile = await generator.generateTile(10, 20);

      expect(tile).toEqual({
        id: 0,
        x: 10,
        y: 20,
        biomeId: 1,
        description: 'You are in a forest at (10, 20).',
      });
    });

  });
});