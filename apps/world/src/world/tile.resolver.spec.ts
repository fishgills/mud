import { TileResolver } from './tile.resolver';
import { WorldService } from './world-refactored.service';

describe('TileResolver', () => {
  let resolver: TileResolver;
  let worldService: any;

  beforeEach(() => {
    worldService = {
      getTileWithNearbyBiomes: jest.fn(),
    };

    resolver = new TileResolver(worldService);
  });

  describe('getTile', () => {
    it('should return tile with nearby biomes', async () => {
      const mockTileData = {
        id: 1,
        x: 10,
        y: 20,
        biomeId: 1,
        biomeName: 'Forest',
        height: 0.5,
        temperature: 0.6,
        moisture: 0.7,
        nearbyBiomes: [
          { biomeName: 'Plains', distance: 5, direction: 'North' },
        ],
        nearbySettlements: [],
      };
      worldService.getTileWithNearbyBiomes.mockResolvedValue(mockTileData);

      const result = await resolver.getTile(10, 20);

      expect(result).toEqual(mockTileData);
      expect(worldService.getTileWithNearbyBiomes).toHaveBeenCalledWith(10, 20);
    });

    it('should handle negative coordinates', async () => {
      const mockTileData = {
        id: 1,
        x: -10,
        y: -20,
        biomeId: 2,
        biomeName: 'Ocean',
        nearbyBiomes: [],
        nearbySettlements: [],
      };
      worldService.getTileWithNearbyBiomes.mockResolvedValue(mockTileData);

      const result = await resolver.getTile(-10, -20);

      expect(result).toEqual(mockTileData);
      expect(worldService.getTileWithNearbyBiomes).toHaveBeenCalledWith(
        -10,
        -20,
      );
    });

    it('should handle zero coordinates', async () => {
      const mockTileData = {
        id: 0,
        x: 0,
        y: 0,
        biomeId: 1,
        biomeName: 'Grassland',
        nearbyBiomes: [],
        nearbySettlements: [],
      };
      worldService.getTileWithNearbyBiomes.mockResolvedValue(mockTileData);

      const result = await resolver.getTile(0, 0);

      expect(result).toEqual(mockTileData);
      expect(worldService.getTileWithNearbyBiomes).toHaveBeenCalledWith(0, 0);
    });

    it('should return tile with settlements', async () => {
      const mockTileData = {
        id: 1,
        x: 10,
        y: 20,
        biomeId: 1,
        biomeName: 'Forest',
        nearbyBiomes: [],
        nearbySettlements: [
          {
            name: 'Test City',
            type: 'city',
            size: 'large',
            population: 10000,
            x: 15,
            y: 25,
            distance: 7.1,
          },
        ],
        currentSettlement: {
          name: 'Current Town',
          type: 'town',
          size: 'medium',
          intensity: 0.8,
          isCenter: false,
        },
      };
      worldService.getTileWithNearbyBiomes.mockResolvedValue(mockTileData);

      const result = await resolver.getTile(10, 20);

      expect(result.nearbySettlements).toHaveLength(1);
      expect(result.currentSettlement).toBeDefined();
      expect(result.currentSettlement?.name).toBe('Current Town');
    });

    it('should return tile with multiple nearby biomes', async () => {
      const mockTileData = {
        id: 1,
        x: 10,
        y: 20,
        biomeId: 1,
        biomeName: 'Forest',
        nearbyBiomes: [
          { biomeName: 'Plains', distance: 5, direction: 'North' },
          { biomeName: 'Mountains', distance: 8, direction: 'East' },
          { biomeName: 'Desert', distance: 12, direction: 'South' },
        ],
        nearbySettlements: [],
      };
      worldService.getTileWithNearbyBiomes.mockResolvedValue(mockTileData);

      const result = await resolver.getTile(10, 20);

      expect(result.nearbyBiomes).toHaveLength(3);
      expect(result.nearbyBiomes[0].biomeName).toBe('Plains');
      expect(result.nearbyBiomes[1].biomeName).toBe('Mountains');
      expect(result.nearbyBiomes[2].biomeName).toBe('Desert');
    });
  });
});
