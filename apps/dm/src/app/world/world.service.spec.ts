import { WorldService } from './world.service';

jest.mock('./world.client', () => ({
  worldClient: {
    getTile: jest.fn(),
    getChunk: jest.fn(),
    health: jest.fn(),
  },
}));

const { worldClient } = jest.requireMock('./world.client') as {
  worldClient: {
    getTile: jest.Mock;
    getChunk: jest.Mock;
    health: jest.Mock;
  };
};

describe('WorldService', () => {
  const nowIso = new Date().toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DM_CHUNK_CACHE_TTL_MS = '60000';
    process.env.DM_CENTER_NEARBY_CACHE_TTL_MS = '60000';
  });

  const createService = () => new WorldService();

  it('maps tile data from API to WorldTile structure', async () => {
    const tileResponse = {
      id: 42,
      x: 10,
      y: -5,
      biomeId: 7,
      biomeName: 'forest',
      description: 'lush',
      height: 0.75,
      temperature: 0.4,
      moisture: 0.6,
      seed: 123,
      chunkX: 1,
      chunkY: -1,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    worldClient.getTile.mockResolvedValue({ status: 200, body: tileResponse });

    const service = createService();
    const result = await service.getTileInfo(tileResponse.x, tileResponse.y);

    expect(result).toMatchObject({
      id: 42,
      biomeName: 'forest',
      description: 'lush',
      seed: 123,
      chunkX: 1,
      chunkY: -1,
    });
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);
  });

  it('falls back to default tile when API returns nothing', async () => {
    worldClient.getTile.mockResolvedValue({ status: 404 });

    const service = createService();
    const result = await service.getTileInfo(0, 0);

    expect(result.biomeName).toBe('grassland');
  });

  it('caches chunk responses within the TTL', async () => {
    const tiles = [{
      id: 1,
      x: 1,
      y: 2,
      biomeId: 1,
      biomeName: 'forest',
      height: 0.5,
      temperature: 0.5,
      moisture: 0.5,
      seed: 10,
      chunkX: 0,
      chunkY: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      description: '',
    }];
    worldClient.getChunk.mockResolvedValue({ status: 200, body: { tiles } });

    const service = createService();

    const first = await service.getChunk(0, 0);
    const second = await service.getChunk(0, 0);

    expect(first).toHaveLength(tiles.length);
    expect(second).toHaveLength(tiles.length);
    const expectedCoords = tiles.map(({ x, y }) => ({ x, y }));
    expect(first.map(({ x, y }) => ({ x, y }))).toEqual(expectedCoords);
    expect(second.map(({ x, y }) => ({ x, y }))).toEqual(expectedCoords);
    expect(worldClient.getChunk).toHaveBeenCalledTimes(1);
  });

  it('deduplicates inflight chunk requests', async () => {
    const tiles = [{
      id: 1,
      x: 3,
      y: 4,
      biomeId: 1,
      biomeName: 'forest',
      height: 0.5,
      temperature: 0.5,
      moisture: 0.5,
      seed: 10,
      chunkX: 0,
      chunkY: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      description: '',
    }];
    worldClient.getChunk.mockResolvedValueOnce({ status: 200, body: { tiles } });

    const service = createService();

    const [a, b] = await Promise.all([
      service.getChunk(1, 1),
      service.getChunk(1, 1),
    ]);

    expect(a).toHaveLength(tiles.length);
    expect(b).toHaveLength(tiles.length);
    const expectedCoords = tiles.map(({ x, y }) => ({ x, y }));
    expect(a.map(({ x, y }) => ({ x, y }))).toEqual(expectedCoords);
    expect(b.map(({ x, y }) => ({ x, y }))).toEqual(expectedCoords);
    expect(worldClient.getChunk).toHaveBeenCalledTimes(1);
  });

  it('caches tile-with-nearby lookups', async () => {
    const payload = {
      id: 1,
      x: 0,
      y: 0,
      biomeId: 2,
      biomeName: 'desert',
      description: 'dry',
      height: 0.2,
      temperature: 0.9,
      moisture: 0.1,
      seed: 321,
      chunkX: 0,
      chunkY: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
      nearbyBiomes: [{ biomeName: 'oasis', distance: 1, direction: 'north' }],
      nearbySettlements: [],
      currentSettlement: null,
    };

    worldClient.getTile.mockResolvedValue({ status: 200, body: payload });

    const service = createService();
    const first = await service.getTileInfoWithNearby(0, 0);
    const second = await service.getTileInfoWithNearby(0, 0);

    expect(first.nearbyBiomes).toHaveLength(1);
    expect(second.nearbyBiomes).toHaveLength(1);
    expect(worldClient.getTile).toHaveBeenCalledTimes(1);
  });

  it('returns false when health check throws', async () => {
    worldClient.health.mockRejectedValue(new Error('boom'));
    const service = createService();

    await expect(service.healthCheck()).resolves.toBe(false);
  });

  it('handles empty getChunk response', async () => {
    worldClient.getChunk.mockResolvedValue({ status: 200, body: null });
    const service = createService();
    const result = await service.getChunk(5, 5);
    expect(result).toEqual([]);
  });

  it('handles getChunk with no tiles', async () => {
    worldClient.getChunk.mockResolvedValue({ status: 200, body: { tiles: [] } });
    const service = createService();
    const result = await service.getChunk(6, 6);
    expect(result).toEqual([]);
  });

  it('falls back to default tile when getTileInfoWithNearby returns null', async () => {
    worldClient.getTile.mockResolvedValue({ status: 200, body: undefined });
    const service = createService();
    const result = await service.getTileInfoWithNearby(99, 99);
    expect(result.tile.biomeName).toBe('grassland');
    expect(result.nearbyBiomes).toEqual([]);
    expect(result.nearbySettlements).toEqual([]);
    expect(result.currentSettlement).toBeUndefined();
  });

  it('handles getTileInfoWithNearby with missing optional fields', async () => {
    const payload = {
      id: 1,
      x: 10,
      y: 10,
      biomeId: 2,
      biomeName: 'swamp',
      description: 'murky',
      height: 0.3,
      temperature: 0.5,
      moisture: 0.9,
      seed: 456,
      chunkX: 0,
      chunkY: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    worldClient.getTile.mockResolvedValue({ status: 200, body: payload });
    const service = createService();
    const result = await service.getTileInfoWithNearby(10, 10);

    expect(result.tile.biomeName).toBe('swamp');
    expect(result.nearbyBiomes).toEqual([]);
    expect(result.nearbySettlements).toEqual([]);
    expect(result.currentSettlement).toBeUndefined();
  });
});
