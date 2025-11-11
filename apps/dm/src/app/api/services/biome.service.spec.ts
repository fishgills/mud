import { BiomeService } from './biome.service';

const makeTile = (x: number, y: number, biomeName: string) => ({
  x,
  y,
  biomeName,
});

describe('BiomeService', () => {
  let service: BiomeService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    service = new BiomeService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('summarizes predominant biomes with directions and timing', () => {
    const player = { x: 0, y: 0 };
    const tiles = [
      makeTile(1, 0, 'forest'),
      makeTile(2, 0, 'forest'),
      makeTile(-1, 0, 'desert'),
    ];
    const timing: any = {};

    const summary = service.generateBiomeSummary(player as any, tiles as any, timing);

    expect(summary[0]).toEqual(
      expect.objectContaining({
        biomeName: 'forest',
        predominantDirections: expect.arrayContaining(['east']),
      }),
    );
    expect(summary[1]).toEqual(
      expect.objectContaining({
        biomeName: 'desert',
        predominantDirections: expect.arrayContaining(['west']),
      }),
    );
    expect(timing.tBiomeSummaryMs).toBeGreaterThanOrEqual(0);
  });
});
