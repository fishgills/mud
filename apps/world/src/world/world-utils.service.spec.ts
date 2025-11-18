import { WorldUtilsService } from './world-utils.service';

describe('WorldUtilsService', () => {
  let service: WorldUtilsService;

  beforeEach(() => {
    service = new WorldUtilsService();
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
      chunkX: Math.floor(123 / WorldUtilsService.CHUNK_SIZE),
      chunkY: Math.floor(87 / WorldUtilsService.CHUNK_SIZE),
    });
  });

  it('calculates Euclidean distance and rounding', () => {
    expect(service.calculateDistance(0, 0, 3, 4)).toBe(5);
    expect(service.roundToDecimalPlaces(Math.PI, 2)).toBe(3.14);
  });
});
