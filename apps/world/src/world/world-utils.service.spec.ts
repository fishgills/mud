import type { Settlement } from '@mud/database';
import { WorldUtilsService } from './world-utils.service';
import { WORLD_CHUNK_SIZE } from '@mud/shared-constants';

describe('WorldUtilsService', () => {
  let service: WorldUtilsService;

  beforeEach(() => {
    service = new WorldUtilsService();
  });

  it('provides minimum settlement spacing by size with fallback', () => {
    expect(service.getMinDistanceBetweenSettlements('large')).toBe(20);
    expect(service.getMinDistanceBetweenSettlements('medium')).toBe(15);
    expect(service.getMinDistanceBetweenSettlements('small')).toBe(10);
    expect(service.getMinDistanceBetweenSettlements('tiny')).toBe(8);
    expect(service.getMinDistanceBetweenSettlements('unknown')).toBe(8);
  });

  it('translates coordinates into compass directions', () => {
    expect(service.calculateDirection(0, 0, 10, 0)).toBe('east');
    expect(service.calculateDirection(0, 0, 0, 10)).toBe('north');
    expect(service.calculateDirection(0, 0, -10, 0)).toBe('west');
    expect(service.calculateDirection(0, 0, 0, -10)).toBe('south');
    expect(service.calculateDirection(0, 0, 10, 10)).toBe('northeast');
    expect(service.calculateDirection(0, 0, -10, 10)).toBe('northwest');
    expect(service.calculateDirection(0, 0, -10, -10)).toBe('southwest');
    expect(service.calculateDirection(0, 0, 10, -10)).toBe('southeast');
  });

  it('returns chunk coordinates using the global chunk size', () => {
    const coords = service.getChunkCoordinates(123, 87);
    expect(coords).toEqual({
      chunkX: Math.floor(123 / WORLD_CHUNK_SIZE),
      chunkY: Math.floor(87 / WORLD_CHUNK_SIZE),
    });
  });

  it('calculates Euclidean distance and rounding', () => {
    expect(service.calculateDistance(0, 0, 3, 4)).toBe(5);
    expect(service.roundToDecimalPlaces(Math.PI, 2)).toBe(3.14);
  });

  it('detects settlement overlap based on minimum spacing', () => {
    const baseSettlement = (overrides: Partial<Settlement>): Settlement => ({
      id: 1,
      name: 'Test',
      type: 'city',
      size: 'large',
      population: 1000,
      x: 0,
      y: 0,
      description: 'desc',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });

    const settlements: Settlement[] = [
      baseSettlement({ id: 1, x: 0, y: 0, size: 'large' }),
      baseSettlement({ id: 2, x: 100, y: 0, size: 'small', type: 'farm' }),
    ];

    expect(service.checkSettlementOverlap(5, 0, 'small', settlements)).toBe(
      true,
    );
    expect(service.checkSettlementOverlap(90, 0, 'small', settlements)).toBe(
      false,
    );
  });
});
