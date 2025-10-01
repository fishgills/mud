jest.mock('@mud/database', () => ({
  Monster: class {},
  getPrismaClient: jest.fn(),
}));

import { VisibilityService } from './visibility.service';
import { PeakService } from './peak.service';
import { BiomeService } from './biome.service';
import { SettlementService } from './settlement.service';
import { DescriptionService } from './description.service';
import { ResponseService } from './response.service';
import { AiService } from '../../../openai/ai.service';

const createWorldService = () => ({
  getTilesInBounds: jest.fn().mockResolvedValue(
    Array.from({ length: 6 }, (_, i) => ({
      x: i,
      y: i,
      biomeName: i % 2 === 0 ? 'forest' : 'plains',
      height: 0.3 + i * 0.1,
    })),
  ),
});

describe('Look view helper services', () => {
  beforeEach(() => {
    jest.spyOn(global.Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('calculates visibility and processes tiles', async () => {
    const worldService = createWorldService();
    const service = new VisibilityService(worldService as any);
    const timing = {
      tPlayerMs: 0,
      tGetCenterMs: 0,
      tGetCenterNearbyMs: 0,
      tBoundsTilesMs: 0,
      tExtBoundsMs: 0,
      tFilterTilesMs: 0,
      tPeaksSortMs: 0,
      tBiomeSummaryMs: 0,
      tSettlementsFilterMs: 0,
      tAiMs: 0,
      tilesCount: 0,
      peaksCount: 0,
    };

    const radius = service.calculateVisibilityRadius({ height: 0.9 });
    expect(radius).toBeLessThanOrEqual(12);

    const { tiles, extTiles } = await service.processTileData(
      { x: 0, y: 0 },
      radius,
      timing,
    );

    expect(tiles.length).toBeGreaterThan(0);
    expect(extTiles.length).toBeGreaterThan(0);
    expect(timing.tilesCount).toBe(tiles.length);
  });

  it('summarizes biomes and peaks and settlements', async () => {
    const biome = new BiomeService();
    const peaks = new PeakService();
    const settlements = new SettlementService();

    const timing = {
      tPlayerMs: 0,
      tGetCenterMs: 0,
      tGetCenterNearbyMs: 0,
      tBoundsTilesMs: 0,
      tExtBoundsMs: 0,
      tFilterTilesMs: 0,
      tPeaksSortMs: 0,
      tBiomeSummaryMs: 0,
      tSettlementsFilterMs: 0,
      tAiMs: 0,
      tilesCount: 0,
      peaksCount: 0,
    };

    const biomeSummary = biome.generateBiomeSummary(
      { x: 0, y: 0 },
      [
        { x: 1, y: 1, biomeName: 'forest' },
        { x: -1, y: 0, biomeName: 'forest' },
        { x: 0, y: 2, biomeName: 'plains' },
      ],
      timing,
    );
    expect(biomeSummary[0].biomeName).toBe('forest');

    const visiblePeaks = peaks.processVisiblePeaks(
      { x: 0, y: 0 },
      5,
      [
        { x: 4, y: 0, height: 0.8 },
        { x: 0, y: 4, height: 0.9 },
      ],
      timing,
    );
    expect(visiblePeaks).toHaveLength(2);

    const visibleSettlements = settlements.processVisibleSettlements(
      { x: 0, y: 0 },
      5,
      {
        nearbySettlements: [
          { name: 'Town', type: 'town', size: 'large', distance: 6, x: 2, y: 2 },
          { name: 'Village', type: 'village', size: 'small', distance: 3, x: 3, y: 3 },
        ],
        currentSettlement: { name: 'Capital', type: 'city', size: 'large' },
      },
      timing,
    );
    expect(visibleSettlements[0].direction).toBe('here');
  });

  it('generates AI descriptions with fallback', async () => {
    const timing = {
      tPlayerMs: 0,
      tGetCenterMs: 0,
      tGetCenterNearbyMs: 0,
      tBoundsTilesMs: 0,
      tExtBoundsMs: 0,
      tFilterTilesMs: 0,
      tPeaksSortMs: 0,
      tBiomeSummaryMs: 0,
      tSettlementsFilterMs: 0,
      tAiMs: 0,
      tilesCount: 0,
      peaksCount: 0,
    };
    const aiService: Pick<AiService, 'getText'> = {
      getText: jest.fn().mockResolvedValue({
        output_text: 'A vivid vista.',
      }),
    };
    const service = new DescriptionService(aiService as AiService);

    const result = await service.generateAiDescription(
      {
        x: 1,
        y: 2,
        biomeName: 'forest',
        description: 'lush',
        height: 0.5,
        temperature: 0.4,
        moisture: 0.6,
      },
      6,
      [
        { biomeName: 'forest', proportion: 0.6, predominantDirections: ['north'] },
      ],
      [
        { x: 5, y: 5, height: 0.8, distance: 5, direction: 'east' },
      ],
      [
        { name: 'Town', type: 'town', size: 'large', distance: 0, direction: 'here' },
      ],
      { name: 'Town', type: 'town', intensity: 0.8 },
      timing,
      [{ slackId: 'S1', name: 'Scout', distance: 2, direction: 'north' } as any],
    );

    expect(result).toContain('A vivid vista.');

    (aiService.getText as jest.Mock).mockRejectedValue(new Error('no ai'));
    const fallback = await service.generateAiDescription(
      {
        x: 1,
        y: 2,
        biomeName: 'forest',
        description: 'lush',
        height: 0.5,
        temperature: 0.4,
        moisture: 0.6,
      },
      6,
      [
        { biomeName: 'forest', proportion: 0.6, predominantDirections: ['north'] },
      ],
      [],
      [],
      null,
      timing,
      [],
    );

    expect(fallback).toContain('roughly 6 tiles');
  });

  it('builds response data structure', () => {
    const service = new ResponseService();
    const result = service.buildResponseData(
      {
        x: 1,
        y: 2,
        biomeName: 'forest',
        description: 'lush',
        height: 0.5,
        temperature: 0.4,
        moisture: 0.6,
      },
      6,
      [],
      [],
      [],
      { name: 'Town', type: 'town', size: 'large', intensity: 1, isCenter: true },
      'desc',
      [],
      [],
    );

    expect(result.location.x).toBe(1);
    expect(result.inSettlement).toBe(true);
  });
});
