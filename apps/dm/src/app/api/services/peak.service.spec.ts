import { PeakService } from './peak.service';

describe('PeakService', () => {
  const service = new PeakService();
  const player = { x: 0, y: 0 } as any;

  it('filters peaks by distance, height, and limits results', () => {
    const timing = {} as any;
    const peaks = service.processVisiblePeaks(
      player,
      8,
      [
        { x: 10, y: 0, height: 0.8 },
        { x: 2, y: 0, height: 0.9 }, // too close
        { x: -10, y: 0, height: 0.95 },
        { x: 0, y: 15, height: 0.7 },
      ] as any,
      timing,
    );

    expect(peaks).toHaveLength(3);
    expect(peaks[0].height).toBeGreaterThanOrEqual(peaks[1].height);
    expect(peaks[0].direction).toMatch(/east|west|north/);
    expect(timing.tPeaksSortMs).toBeGreaterThanOrEqual(0);
    expect(timing.peaksCount).toBe(3);
  });

  it('uses minimum peak distance of at least 3', () => {
    const timing = {} as any;
    const peaks = service.processVisiblePeaks(
      player,
      4,
      [{ x: 2, y: 0, height: 0.9 }] as any,
      timing,
    );
    expect(peaks).toHaveLength(0);
  });
});
