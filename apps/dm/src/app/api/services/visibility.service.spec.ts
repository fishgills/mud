import { VisibilityService } from './visibility.service';

const createWorldService = () => ({
  getTilesInBounds: jest.fn(),
});

const makeTile = (overrides: Partial<Record<string, number | string>> = {}) => ({
  x: overrides.x ?? 0,
  y: overrides.y ?? 0,
  biomeName: overrides.biomeName ?? 'grassland',
  height: overrides.height ?? 0.5,
});

describe('VisibilityService', () => {
  let service: VisibilityService;
  let worldService: ReturnType<typeof createWorldService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    worldService = createWorldService();
    service = new VisibilityService(worldService as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('clamps visibility radius between 3 and 12 based on tile height', () => {
    expect(service.calculateVisibilityRadius({ height: -1 })).toBe(10);
    expect(service.calculateVisibilityRadius({ height: 0.5 })).toBe(12);
    expect(service.calculateVisibilityRadius({ height: 2 })).toBe(12);
  });

  it('processes tile data using prefetched ext tiles and updates timing', async () => {
    const player = { x: 0, y: 0 };
    const timing = { } as any;
    const extTiles = [
      makeTile({ x: 0, y: 0 }),
      makeTile({ x: 5, y: 0 }),
      makeTile({ x: 20, y: 0 }),
    ];
    const prefetch = {
      extTilesPromise: Promise.resolve(extTiles),
      tExtStart: Date.now(),
    };

    const res = await service.processTileData(player as any, 6, timing, prefetch);

    expect(res.tiles).toHaveLength(2);
    expect(res.extTiles).toBe(extTiles);
    expect(timing.tBoundsTilesMs).toBe(timing.tExtBoundsMs);
  });
});
