import { PeakService } from './peak.service';

const makeTile = (
  x: number,
  y: number,
  height: number,
): Record<string, number> => ({
  x,
  y,
  height,
});

describe('PeakService', () => {
  let service: PeakService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    service = new PeakService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('filters peaks outside minimum distance and annotates direction', () => {
    const player = { x: 0, y: 0 };
    const timing: any = {};
    const peaks = service.processVisiblePeaks(
      player as any,
      6,
      [
        makeTile(1, 0, 0.9),
        makeTile(5, 0, 0.8),
        makeTile(-4, 0, 0.85),
      ] as any,
      timing,
    );

    expect(peaks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ direction: 'east' }),
        expect.objectContaining({ direction: 'west' }),
      ]),
    );
    expect(timing.tPeaksSortMs).toBeGreaterThanOrEqual(0);
    expect(timing.peaksCount).toBe(peaks.length);
  });
});
