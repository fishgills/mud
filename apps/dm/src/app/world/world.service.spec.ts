import { authorizedFetch } from '@mud/gcp-auth';
import { WorldService } from './world.service';
import { refreshEnv } from '../../env';

jest.mock('@mud/gcp-auth', () => ({
  authorizedFetch: jest.fn(),
}));

const mockFetch = authorizedFetch as jest.MockedFunction<
  typeof authorizedFetch
>;

const createResponse = <T>(data: T, init?: Partial<Response>): Response => {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: 'http://test',
    clone() {
      return createResponse(data, init);
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as unknown as Response;
};

const createErrorResponse = (status: number, message: string): Response => {
  return {
    ok: false,
    status,
    statusText: message,
    text: async () => message,
    json: async () => {
      throw new Error('not json');
    },
    headers: new Headers(),
    redirected: false,
    type: 'basic',
    url: 'http://test',
    clone() {
      return createErrorResponse(status, message);
    },
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as unknown as Response;
};

describe('WorldService (REST)', () => {
  const nowIso = new Date().toISOString();
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
    process.env.DM_CHUNK_CACHE_TTL_MS = '60000';
    process.env.DM_CENTER_NEARBY_CACHE_TTL_MS = '60000';
    process.env.WORLD_SERVICE_URL = 'http://world.test/world';
    refreshEnv();
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
    refreshEnv();
  });

  const serviceFactory = () => new WorldService();

  it('parses tile responses into WorldTile', async () => {
    mockFetch.mockResolvedValueOnce(
      createResponse({
        id: 1,
        x: 5,
        y: -3,
        biomeId: 4,
        biomeName: 'forest',
        description: 'lush',
        height: 0.7,
        temperature: 0.4,
        moisture: 0.6,
        seed: 99,
        chunkX: 0,
        chunkY: -1,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    );

    const service = serviceFactory();
    const tile = await service.getTileInfo(5, -3);

    expect(tile.biomeName).toBe('forest');
    expect(tile.createdAt).toBeInstanceOf(Date);
    expect(tile.updatedAt).toBeInstanceOf(Date);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://world.test/world/tiles/5/-3',
      {
        method: 'GET',
        headers: { accept: 'application/json' },
      },
    );
  });

  it('normalizes base URL missing the /world prefix', async () => {
    process.env.WORLD_SERVICE_URL = 'http://world.test';
    refreshEnv();
    mockFetch.mockResolvedValueOnce(
      createResponse({
        id: 10,
        x: 1,
        y: 2,
        biomeId: 4,
        biomeName: 'forest',
        description: 'lush',
        height: 0.7,
        temperature: 0.4,
        moisture: 0.6,
        seed: 99,
        chunkX: 0,
        chunkY: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      }),
    );

    const service = serviceFactory();
    await service.getTileInfo(1, 2);

    expect(mockFetch).toHaveBeenCalledWith(
      'http://world.test/world/tiles/1/2',
      {
        method: 'GET',
        headers: { accept: 'application/json' },
      },
    );
  });

  it('falls back to default tile when request fails', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse(500, 'boom'));

    const service = serviceFactory();
    const tile = await service.getTileInfo(0, 0);

    expect(tile.biomeName).toBe('grassland');
  });

  it('caches chunk tiles within TTL', async () => {
    const tiles = [
      {
        id: 1,
        x: 0,
        y: 0,
        biomeId: 1,
        biomeName: 'field',
        description: null,
        height: 0.3,
        temperature: 0.5,
        moisture: 0.6,
        seed: 1,
        chunkX: 0,
        chunkY: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    mockFetch.mockResolvedValueOnce(
      createResponse({ chunkX: 0, chunkY: 0, tiles }),
    );

    const service = serviceFactory();
    const first = await service.getChunk(0, 0);
    const second = await service.getChunk(0, 0);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('deduplicates inflight chunk requests', async () => {
    const tiles = [
      {
        id: 2,
        x: 1,
        y: 1,
        biomeId: 2,
        biomeName: 'desert',
        description: null,
        height: 0.2,
        temperature: 0.9,
        moisture: 0.2,
        seed: 2,
        chunkX: 0,
        chunkY: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      },
    ];
    mockFetch.mockResolvedValueOnce(
      createResponse({ chunkX: 0, chunkY: 0, tiles }),
    );

    const service = serviceFactory();
    const [a, b] = await Promise.all([
      service.getChunk(0, 0),
      service.getChunk(0, 0),
    ]);

    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('fetches and caches tile with nearby data', async () => {
    mockFetch.mockResolvedValueOnce(
      createResponse({
        id: 3,
        x: 2,
        y: 2,
        biomeId: 3,
        biomeName: 'plains',
        description: null,
        height: 0.5,
        temperature: 0.5,
        moisture: 0.5,
        seed: 3,
        chunkX: 0,
        chunkY: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
        nearbyBiomes: [
          { biomeName: 'forest', distance: 1, direction: 'north' },
        ],
        nearbySettlements: [],
        currentSettlement: null,
      }),
    );

    const service = serviceFactory();
    const first = await service.getTileInfoWithNearby(2, 2);
    const second = await service.getTileInfoWithNearby(2, 2);

    expect(first.nearbyBiomes).toHaveLength(1);
    expect(second.nearbyBiomes).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('returns false when health check fails', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse(503, 'unavailable'));
    const service = serviceFactory();
    await expect(service.healthCheck()).resolves.toBe(false);
  });

  it('fetches nearest settlement summary', async () => {
    mockFetch.mockResolvedValueOnce(
      createResponse({
        settlement: {
          id: 10,
          name: 'Fooville',
          type: 'town',
          size: 'medium',
          population: 550,
          description: 'A friendly town',
          x: 5,
          y: 6,
          distance: 12.5,
          direction: 'north',
          isCurrent: false,
        },
      }),
    );

    const service = serviceFactory();
    const settlement = await service.findNearestSettlement(5, 6);

    expect(settlement?.name).toBe('Fooville');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://world.test/world/settlements/nearest?x=5&y=6',
      {
        method: 'GET',
        headers: { accept: 'application/json' },
      },
    );
  });

  it('returns null when nearest settlement fetch fails', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse(500, 'oops'));

    const service = serviceFactory();
    const settlement = await service.findNearestSettlement(1, 2);

    expect(settlement).toBeNull();
  });
});
