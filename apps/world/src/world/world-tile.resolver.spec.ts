import { WorldTileResolver } from './world-tile.resolver';
import { WorldDatabaseService } from './world-database.service';
import type { WorldTile } from './models';

type WorldDatabaseMock = Pick<WorldDatabaseService, 'getBiomeById'>;

const createWorldTile = (overrides: Partial<WorldTile> = {}): WorldTile => ({
  id: overrides.id ?? 1,
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  biomeId: overrides.biomeId ?? 1,
  biomeName: overrides.biomeName ?? 'Plains',
  description: overrides.description ?? null,
  height: overrides.height ?? 0,
  temperature: overrides.temperature ?? 0,
  moisture: overrides.moisture ?? 0,
  seed: overrides.seed ?? 0,
  chunkX: overrides.chunkX ?? 0,
  chunkY: overrides.chunkY ?? 0,
  createdAt: overrides.createdAt ?? new Date(),
  updatedAt: overrides.updatedAt ?? new Date(),
  biome: overrides.biome ?? null,
});

describe('WorldTileResolver', () => {
  let resolver: WorldTileResolver;
  let worldDatabase: jest.Mocked<WorldDatabaseMock>;

  beforeEach(() => {
    worldDatabase = {
      getBiomeById: jest.fn<
        ReturnType<WorldDatabaseService['getBiomeById']>,
        Parameters<WorldDatabaseService['getBiomeById']>
      >(() => Promise.resolve(null)),
    };

    resolver = new WorldTileResolver(
      worldDatabase as unknown as WorldDatabaseService,
    );
  });

  describe('biome', () => {
    it('should resolve biome for tile', async () => {
      const mockBiome = {
        id: 1,
        name: 'Forest',
      };
      worldDatabase.getBiomeById.mockResolvedValue(mockBiome);

      const tile = createWorldTile({
        id: 1,
        x: 10,
        y: 20,
        biomeId: 1,
        biomeName: 'Forest',
      });

      const result = await resolver.biome(tile);

      expect(result).toEqual(mockBiome);
      expect(worldDatabase.getBiomeById).toHaveBeenCalledWith(1);
    });

    it('should throw error when biome not found', async () => {
      worldDatabase.getBiomeById.mockResolvedValue(null);

      const tile = createWorldTile({
        id: 1,
        x: 10,
        y: 20,
        biomeId: 999,
        biomeName: 'Unknown',
      });

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

        const tile = createWorldTile({
          id: 1,
          x: 10,
          y: 20,
          biomeId: mockBiome.id,
          biomeName: mockBiome.name,
        });

        const result = await resolver.biome(tile);

        expect(result).toEqual(mockBiome);
        expect(worldDatabase.getBiomeById).toHaveBeenCalledWith(mockBiome.id);
      }
    });
  });
});
