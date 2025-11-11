import { VisibilityService } from './visibility.service';
import type { WorldService } from '../../world/world.service';

describe('VisibilityService', () => {
  let worldService: jest.Mocked<WorldService>;
  let service: VisibilityService;

  beforeEach(() => {
    worldService = {
      getTilesInBounds: jest.fn(),
    } as unknown as jest.Mocked<WorldService>;
    service = new VisibilityService(worldService);
  });

  it('clamps visibility radius between sensible bounds', () => {
    expect(service.calculateVisibilityRadius({ height: -10 })).toBeGreaterThan(
      3,
    );
    expect(service.calculateVisibilityRadius({ height: 10 })).toBe(12);
    const mid = service.calculateVisibilityRadius({ height: 0.5 });
    expect(mid).toBeGreaterThan(3);
    expect(mid).toBeLessThanOrEqual(12);
  });

  it('fetches tile data with optional prefetched ext tiles', async () => {
    const tiles = [
      { x: 0, y: 0, height: 0.5 },
      { x: 3, y: 4, height: 0.2 },
      { x: 20, y: 20, height: 0.3 },
    ];
    worldService.getTilesInBounds.mockResolvedValue(tiles as any);
    const timing: any = {};
    const player = { x: 0, y: 0 } as any;

    const result = await service.processTileData(player, 5, timing);
    expect(worldService.getTilesInBounds).toHaveBeenCalled();
    expect(result.tiles).toHaveLength(2);
    expect(result.extTiles).toHaveLength(3);
    expect(timing.tExtBoundsMs).toBeGreaterThanOrEqual(0);
    expect(timing.tilesCount).toBe(2);

    const prefetchTiming: any = {};
    const prefetched = Promise.resolve(tiles as any);
    const resultPrefetch = await service.processTileData(player, 5, prefetchTiming, {
      extTilesPromise: prefetched,
      tExtStart: Date.now() - 5,
    });
    expect(resultPrefetch.extTiles).toEqual(tiles);
    expect(prefetchTiming.tExtBoundsMs).toBeGreaterThanOrEqual(0);
  });
});
