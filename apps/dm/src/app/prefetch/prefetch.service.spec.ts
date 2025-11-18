import { PrefetchService } from './prefetch.service';
import type {
  PlayerMoveEvent,
  PlayerRespawnEvent,
  PlayerSpawnEvent,
} from '../../shared/event-bus';
import type { WorldService } from '../world/world.service';
import { Logger } from '@nestjs/common';

jest.mock('../../shared/event-bus', () => ({
  EventBus: {
    on: jest.fn(),
  },
}));

const { EventBus } = jest.requireMock('../../shared/event-bus') as {
  EventBus: { on: jest.Mock };
};

describe('PrefetchService', () => {
  const createWorldMock = () =>
    ({
      getTileInfoWithNearby: jest.fn().mockResolvedValue({
        tile: { x: 10, y: 20 },
        nearbyBiomes: [],
      }),
      getTilesInBounds: jest
        .fn()
        .mockResolvedValue([{ x: 0, y: 0, biomeName: 'forest' }]),
    }) as unknown as jest.Mocked<WorldService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined as unknown as void);
    jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined as unknown as void);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('registers move/spawn/respawn listeners on construction', () => {
    const world = createWorldMock();
    new PrefetchService(world);

    expect(EventBus.on).toHaveBeenCalledTimes(3);
    expect(EventBus.on).toHaveBeenCalledWith(
      'player:move',
      expect.any(Function),
    );
    expect(EventBus.on).toHaveBeenCalledWith(
      'player:spawn',
      expect.any(Function),
    );
    expect(EventBus.on).toHaveBeenCalledWith(
      'player:respawn',
      expect.any(Function),
    );
  });

  it('prefetches center and extended tiles when movement events fire', async () => {
    const world = createWorldMock();
    new PrefetchService(world);

    const moveHandler = EventBus.on.mock.calls.find(
      ([event]) => event === 'player:move',
    )?.[1] as (e: PlayerMoveEvent) => Promise<void>;

    expect(moveHandler).toBeDefined();

    const event: PlayerMoveEvent = {
      eventType: 'player:move',
      player: {} as any,
      fromX: 5,
      fromY: 5,
      toX: 12,
      toY: 18,
      timestamp: new Date(),
    };
    await moveHandler(event);
    await new Promise((resolve) => setImmediate(resolve));

    expect(world.getTileInfoWithNearby).toHaveBeenCalledWith(12, 18);
    const radius = 18;
    expect(world.getTilesInBounds).toHaveBeenCalledWith(
      12 - radius,
      12 + radius,
      18 - radius,
      18 + radius,
    );
  });

  it('handles spawn and respawn events without duplication', async () => {
    const world = createWorldMock();
    new PrefetchService(world);

    const spawnHandler = EventBus.on.mock.calls.find(
      ([event]) => event === 'player:spawn',
    )?.[1] as (e: PlayerSpawnEvent) => Promise<void>;
    const respawnHandler = EventBus.on.mock.calls.find(
      ([event]) => event === 'player:respawn',
    )?.[1] as (e: PlayerRespawnEvent) => Promise<void>;

    expect(spawnHandler).toBeDefined();
    expect(respawnHandler).toBeDefined();

    await spawnHandler({
      eventType: 'player:spawn',
      player: {} as any,
      x: 7,
      y: 8,
      timestamp: new Date(),
    });
    await new Promise((resolve) => setImmediate(resolve));

    await respawnHandler({
      eventType: 'player:respawn',
      player: {} as any,
      x: 1,
      y: 2,
      timestamp: new Date(),
    });
    await new Promise((resolve) => setImmediate(resolve));

    expect(world.getTileInfoWithNearby).toHaveBeenCalledWith(7, 8);
    expect(world.getTileInfoWithNearby).toHaveBeenCalledWith(1, 2);
  });

  it('reports prefetch failures without throwing for spawn/respawn triggers', async () => {
    const world = createWorldMock();
    world.getTileInfoWithNearby.mockRejectedValueOnce(new Error('center boom'));
    world.getTilesInBounds.mockRejectedValueOnce(new Error('bounds boom'));
    const service = new PrefetchService(world);
    const debugSpy = jest.spyOn(Logger.prototype, 'debug');

    await (
      service as unknown as {
        prefetchAt: (x: number, y: number, reason: string) => Promise<void>;
      }
    ).prefetchAt(3, 4, 'player:respawn');

    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('Prefetched @(3,4) reason=player:respawn'),
    );
  });
});
