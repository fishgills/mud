import { ChunkGeneratorService } from './chunk-generator.service';
import { WorldUtilsService } from './world-utils.service';

describe('ChunkGeneratorService', () => {
  let service: ChunkGeneratorService;
  let worldUtils: WorldUtilsService;

  beforeEach(() => {
    worldUtils = new WorldUtilsService();
    service = new ChunkGeneratorService(worldUtils);
  });

  describe('generateChunk', () => {
    it('should generate a chunk with tiles', () => {
      const chunkData = service.generateChunk(0, 0, 12345);

      expect(chunkData).toBeDefined();
      expect(chunkData.tiles).toBeDefined();
      expect(chunkData.tiles.length).toBe(2500); // 50x50 chunk
      expect(chunkData.stats).toBeDefined();
      expect(chunkData.settlements).toBeDefined();
    });

    it('should generate deterministic chunks with same seed', () => {
      const chunk1 = service.generateChunk(0, 0, 12345);
      const chunk2 = service.generateChunk(0, 0, 12345);

      expect(chunk1.tiles[0].biomeId).toBe(chunk2.tiles[0].biomeId);
      expect(chunk1.tiles[0].height).toBe(chunk2.tiles[0].height);
      expect(chunk1.stats.averageHeight).toBe(chunk2.stats.averageHeight);
    });

    it('should generate different chunks with different seeds', () => {
      const chunk1 = service.generateChunk(0, 0, 12345);
      const chunk2 = service.generateChunk(0, 0, 54321);

      // At least some tiles should differ
      const differentTiles = chunk1.tiles.filter(
        (t1, idx) => t1.biomeId !== chunk2.tiles[idx].biomeId,
      );
      expect(differentTiles.length).toBeGreaterThan(0);
    });

    it('should generate different chunks at different coordinates', () => {
      const chunk1 = service.generateChunk(0, 0, 12345);
      const chunk2 = service.generateChunk(1, 1, 12345);

      expect(chunk1.tiles[0].x).not.toBe(chunk2.tiles[0].x);
      expect(chunk1.tiles[0].y).not.toBe(chunk2.tiles[0].y);
    });

    it('should include biome statistics', () => {
      const chunkData = service.generateChunk(0, 0, 12345);

      expect(chunkData.stats.biomes).toBeDefined();
      expect(Object.keys(chunkData.stats.biomes).length).toBeGreaterThan(0);
      expect(chunkData.stats.averageHeight).toBeGreaterThanOrEqual(0);
      expect(chunkData.stats.averageHeight).toBeLessThanOrEqual(1);
    });

    it('should have tiles with valid coordinates', () => {
      const chunkData = service.generateChunk(2, 3, 12345);

      const firstTile = chunkData.tiles[0];
      expect(firstTile.x).toBeGreaterThanOrEqual(100); // 2 * 50
      expect(firstTile.y).toBeGreaterThanOrEqual(150); // 3 * 50
    });
  });

  describe('generateTileAt', () => {
    it('should generate a single tile at coordinates', () => {
      const tile = service.generateTileAt(10, 20, 12345);

      expect(tile).toBeDefined();
      expect(tile.x).toBe(10);
      expect(tile.y).toBe(20);
      expect(tile.biomeId).toBeDefined();
      expect(tile.height).toBeDefined();
      expect(tile.temperature).toBeDefined();
      expect(tile.moisture).toBeDefined();
    });

    it('should generate deterministic tiles', () => {
      const tile1 = service.generateTileAt(10, 20, 12345);
      const tile2 = service.generateTileAt(10, 20, 12345);

      expect(tile1.biomeId).toBe(tile2.biomeId);
      expect(tile1.height).toBe(tile2.height);
      expect(tile1.moisture).toBe(tile2.moisture);
    });

    it('should have valid height, moisture, and temperature values', () => {
      const tile = service.generateTileAt(10, 20, 12345);

      expect(tile.height).toBeGreaterThanOrEqual(0);
      expect(tile.height).toBeLessThanOrEqual(1);
      expect(tile.moisture).toBeGreaterThanOrEqual(0);
      expect(tile.moisture).toBeLessThanOrEqual(1);
      expect(tile.temperature).toBeGreaterThanOrEqual(0);
      expect(tile.temperature).toBeLessThanOrEqual(1);
    });
  });
});
