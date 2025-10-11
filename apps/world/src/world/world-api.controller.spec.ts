import { Test, TestingModule } from '@nestjs/testing';
import { WorldApiController } from './world-api.controller';
import { WorldService } from './world-refactored.service';
import type {
  WorldTile as InternalWorldTile,
  TileWithNearbyBiomes as InternalTileWithNearby,
  Settlement as InternalSettlement,
} from './models';
import type { ChunkData as ApiChunkData } from '@mud/api-contracts';

describe('WorldApiController', () => {
  let controller: WorldApiController;
  let worldService: jest.Mocked<WorldService>;

  const createTile = (overrides: Partial<InternalWorldTile> = {}): InternalWorldTile => ({
    id: 1,
    x: 0,
    y: 0,
    biomeId: 10,
    biomeName: 'forest',
    description: null,
    height: 0.5,
    temperature: 0.6,
    moisture: 0.4,
    seed: 123,
    chunkX: 0,
    chunkY: 0,
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    biome: { id: 10, name: 'forest' },
    ...overrides,
  });

  const createSettlement = (
    overrides: Partial<InternalSettlement> = {},
  ): InternalSettlement => ({
    id: 1,
    name: 'Testville',
    type: 'town',
    x: 0,
    y: 0,
    size: 'medium',
    population: 100,
    description: 'A small town',
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorldApiController],
      providers: [
        {
          provide: WorldService,
          useValue: {
            getTileWithNearbyBiomes: jest.fn(),
            getChunkTiles: jest.fn(),
            getChunkTileCount: jest.fn(),
            getChunkSettlements: jest.fn(),
            getChunkStats: jest.fn(),
            getChunkBiomeStats: jest.fn(),
            getTilesInBounds: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(WorldApiController);
    worldService = module.get(WorldService);
  });

  it('returns healthy status', async () => {
    const response = await (controller as unknown as { handleHealth: () => Promise<any> }).handleHealth();
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('healthy');
    expect(typeof response.body.timestamp).toBe('string');
  });

  it('serializes tile with nearby information', async () => {
    const internalTile: InternalTileWithNearby = {
      ...createTile({ description: 'Forest tile' }),
      nearbyBiomes: [{ biomeName: 'forest', distance: 1, direction: 'north' }],
      nearbySettlements: [
        {
          name: 'Testville',
          type: 'town',
          size: 'medium',
          population: 100,
          x: 1,
          y: 1,
          description: 'A nearby town',
          distance: 1.5,
        },
      ],
      currentSettlement: {
        name: 'Testville',
        type: 'town',
        size: 'medium',
        intensity: 0.8,
        isCenter: true,
      },
    };

    worldService.getTileWithNearbyBiomes.mockResolvedValue(internalTile);

    const response = await (controller as unknown as {
      handleGetTile: (x: number, y: number) => Promise<any>;
    }).handleGetTile(0, 0);

    expect(response.status).toBe(200);
    expect(response.body.description).toBe('Forest tile');
    expect(response.body.createdAt).toBe('2024-01-01T00:00:00.000Z');
    expect(response.body.nearbyBiomes).toHaveLength(1);
    expect(response.body.currentSettlement?.name).toBe('Testville');
  });

  it('builds chunk response with optional data', async () => {
    const tiles = [createTile({ id: 1 }), createTile({ id: 2, x: 1 })];
    const settlements = [createSettlement()];

    worldService.getChunkTiles.mockResolvedValue(tiles);
    worldService.getChunkTileCount.mockResolvedValue(tiles.length);
    worldService.getChunkSettlements.mockResolvedValue(settlements);
    worldService.getChunkStats.mockResolvedValue({
      averageHeight: 0.4,
      averageTemperature: 0.5,
      averageMoisture: 0.6,
    });
    worldService.getChunkBiomeStats.mockResolvedValue([
      { biomeName: 'forest', count: 2 },
    ]);

    const response = await (controller as unknown as {
      handleGetChunk: (
        chunkX: number,
        chunkY: number,
        query: {
          limit?: number;
          offset?: number;
          includeSettlements?: boolean;
          includeStats?: boolean;
          includeBiomeStats?: boolean;
        },
      ) => Promise<any>;
    }).handleGetChunk(0, 0, { limit: 1, offset: 0, includeSettlements: true });

    expect(response.status).toBe(200);
    expect(response.body.tiles).toHaveLength(2);
    expect(response.body.paginatedTiles?.tiles).toHaveLength(1);
    expect(response.body.settlements?.[0].name).toBe('Testville');
    expect(response.body.stats?.averageHeight).toBe(0.4);
    expect(response.body.biomeStats).toEqual([
      { biomeName: 'forest', count: 2 },
    ]);
  });

  it('returns tiles in bounds', async () => {
    const tiles = [createTile({ x: 5, y: 5 })];
    worldService.getTilesInBounds.mockResolvedValue(tiles);

    const response = await (controller as unknown as {
      handleGetTilesInBounds: (
        minX: number,
        maxX: number,
        minY: number,
        maxY: number,
      ) => Promise<any>;
    }).handleGetTilesInBounds(0, 10, 0, 10);

    expect(response.status).toBe(200);
    expect(response.body[0].x).toBe(5);
    expect(response.body[0].createdAt).toBe('2024-01-01T00:00:00.000Z');
  });
});
