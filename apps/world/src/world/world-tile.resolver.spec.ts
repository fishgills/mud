import { WorldTileResolver } from './world-tile.resolver';
import { WorldDatabaseService } from './world-database.service';

describe('WorldTileResolver', () => {
  let resolver: WorldTileResolver;
  let worldDatabase: any;

  beforeEach(() => {
    worldDatabase = {
      getBiomeById: jest.fn(),
    };

    resolver = new WorldTileResolver(worldDatabase);
  });

  describe('biome', () => {
    it('should resolve biome for tile', async () => {
      const mockBiome = {
        id: 1,
        name: 'Forest',
      };
      worldDatabase.getBiomeById.mockResolvedValue(mockBiome);

      const tile = {
        id: 1,
        x: 10,
        y: 20,
        biomeId: 1,
        biomeName: 'Forest',
      } as any;

      const result = await resolver.biome(tile);

      expect(result).toEqual(mockBiome);
      expect(worldDatabase.getBiomeById).toHaveBeenCalledWith(1);
    });

    it('should throw error when biome not found', async () => {
      worldDatabase.getBiomeById.mockResolvedValue(null);

      const tile = {
        id: 1,
        x: 10,
        y: 20,
        biomeId: 999,
        biomeName: 'Unknown',
      } as any;

      await expect(resolver.biome(tile)).rejects.toThrow(
        'Biome with id 999 not found',
      );
    });

    it('should handle different biome IDs', async () => {
      const mockBiomes = [
        { id: 1, name: 'Forest' },
        { id: 2, name: 'Plains' },
        { id: 3, name: 'Mountains' },
      ];

      for (const mockBiome of mockBiomes) {
        worldDatabase.getBiomeById.mockResolvedValue(mockBiome);

        const tile = {
          id: 1,
          x: 10,
          y: 20,
          biomeId: mockBiome.id,
          biomeName: mockBiome.name,
        } as any;

        const result = await resolver.biome(tile);

        expect(result).toEqual(mockBiome);
        expect(worldDatabase.getBiomeById).toHaveBeenCalledWith(mockBiome.id);
      }
    });
  });
});
