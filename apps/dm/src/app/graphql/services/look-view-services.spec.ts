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
import { NearbyPlayerInfo } from '../types/response.types';

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
    const service = new VisibilityService(
      worldService as unknown as Parameters<
        typeof VisibilityService.prototype.constructor
      >[0],
    );
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

  it('calculates visibility with edge case heights', () => {
    const worldService = createWorldService();
    const service = new VisibilityService(
      worldService as unknown as Parameters<
        typeof VisibilityService.prototype.constructor
      >[0],
    );

    // Test minimum height (should clamp to minimum visibility)
    const minRadius = service.calculateVisibilityRadius({ height: 0 });
    expect(minRadius).toBeGreaterThanOrEqual(3);
    expect(minRadius).toBeLessThanOrEqual(12);

    // Test maximum height (should clamp to maximum visibility)
    const maxRadius = service.calculateVisibilityRadius({ height: 1.5 });
    expect(maxRadius).toBeLessThanOrEqual(12);

    // Test negative height (should clamp to minimum)
    const negRadius = service.calculateVisibilityRadius({ height: -0.5 });
    expect(negRadius).toBeGreaterThanOrEqual(3);

    // Test mid-range height
    const midRadius = service.calculateVisibilityRadius({ height: 0.5 });
    expect(midRadius).toBeGreaterThanOrEqual(3);
    expect(midRadius).toBeLessThanOrEqual(12);
  });

  it('processes tiles with various radii', async () => {
    const worldService = createWorldService();
    const service = new VisibilityService(
      worldService as unknown as Parameters<
        typeof VisibilityService.prototype.constructor
      >[0],
    );
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

    // Test with minimum radius
    const minResult = await service.processTileData({ x: 0, y: 0 }, 3, timing);
    expect(minResult.tiles).toBeDefined();

    // Test with maximum radius
    const maxResult = await service.processTileData({ x: 0, y: 0 }, 12, timing);
    expect(maxResult.tiles).toBeDefined();

    // Test with large radius that gets clamped
    const clampedResult = await service.processTileData(
      { x: 5, y: 5 },
      50,
      timing,
    );
    expect(clampedResult.tiles).toBeDefined();
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
          {
            name: 'Town',
            type: 'town',
            size: 'large',
            distance: 6,
            x: 2,
            y: 2,
          },
          {
            name: 'Village',
            type: 'village',
            size: 'small',
            distance: 3,
            x: 3,
            y: 3,
          },
        ],
        currentSettlement: { name: 'Capital', type: 'city', size: 'large' },
      },
      timing,
    );
    expect(visibleSettlements[0].direction).toBe('here');
  });

  it('handles edge cases in biome summary', () => {
    const biome = new BiomeService();
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

    // Test with empty tiles
    const emptyResult = biome.generateBiomeSummary({ x: 0, y: 0 }, [], timing);
    expect(emptyResult).toHaveLength(0);

    // Test with single biome
    const singleResult = biome.generateBiomeSummary(
      { x: 0, y: 0 },
      [{ x: 1, y: 1, biomeName: 'forest' }],
      timing,
    );
    expect(singleResult[0].biomeName).toBe('forest');

    // Test with multiple directions for same biome
    const multiDirResult = biome.generateBiomeSummary(
      { x: 0, y: 0 },
      [
        { x: 1, y: 0, biomeName: 'forest' }, // east
        { x: -1, y: 0, biomeName: 'forest' }, // west
        { x: 0, y: 1, biomeName: 'forest' }, // north
        { x: 0, y: -1, biomeName: 'forest' }, // south
      ],
      timing,
    );
    expect(multiDirResult[0].predominantDirections.length).toBeGreaterThan(0);
  });

  it('handles edge cases in peak processing', () => {
    const peaks = new PeakService();
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

    // Test with no peaks
    const noPeaks = peaks.processVisiblePeaks({ x: 0, y: 0 }, 5, [], timing);
    expect(noPeaks).toHaveLength(0);

    // Test with far peaks (still visible if high enough)
    const farPeaks = peaks.processVisiblePeaks(
      { x: 0, y: 0 },
      5,
      [{ x: 100, y: 100, height: 0.9 }],
      timing,
    );
    expect(farPeaks).toHaveLength(1); // Far peaks are still processed if height >= 0.7

    // Test with low height peaks (below 0.7 threshold - filtered out)
    const lowPeaks = peaks.processVisiblePeaks(
      { x: 0, y: 0 },
      5,
      [{ x: 5, y: 5, height: 0.5 }],
      timing,
    );
    expect(lowPeaks).toHaveLength(0); // Below 0.7 threshold

    // Test with peaks too close (within minPeakDistance)
    const closePeaks = peaks.processVisiblePeaks(
      { x: 0, y: 0 },
      10,
      [
        { x: 1, y: 1, height: 0.8 }, // distance ~1.4, minPeakDistance is 5
        { x: 10, y: 0, height: 0.9 }, // distance 10, should be included
      ],
      timing,
    );
    expect(closePeaks.length).toBe(1); // Only the far peak is included

    // Test sorting by height (takes top 6)
    const manyPeaks = peaks.processVisiblePeaks(
      { x: 0, y: 0 },
      20,
      [
        { x: 20, y: 0, height: 0.75 },
        { x: 0, y: 20, height: 0.95 },
        { x: 15, y: 15, height: 0.85 },
        { x: 20, y: 20, height: 0.72 },
        { x: 25, y: 0, height: 0.88 },
        { x: 0, y: 25, height: 0.91 },
        { x: 18, y: 18, height: 0.78 },
        { x: 22, y: 22, height: 0.82 },
      ],
      timing,
    );
    expect(manyPeaks.length).toBeLessThanOrEqual(6); // Max 6 peaks
    expect(manyPeaks[0].height).toBeGreaterThanOrEqual(
      manyPeaks[manyPeaks.length - 1].height,
    ); // Sorted by height
  });

  it('handles edge cases in settlement processing', () => {
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

    // Test with no settlements
    const noSettlements = settlements.processVisibleSettlements(
      { x: 0, y: 0 },
      5,
      { nearbySettlements: [], currentSettlement: null },
      timing,
    );
    expect(noSettlements).toHaveLength(0);

    // Test with only current settlement
    const onlyCurrent = settlements.processVisibleSettlements(
      { x: 0, y: 0 },
      5,
      {
        nearbySettlements: [],
        currentSettlement: { name: 'City', type: 'city', size: 'large' },
      },
      timing,
    );
    expect(onlyCurrent[0].direction).toBe('here');

    // Test with settlements outside visibility
    const farSettlements = settlements.processVisibleSettlements(
      { x: 0, y: 0 },
      5,
      {
        nearbySettlements: [
          {
            name: 'Far',
            type: 'town',
            size: 'small',
            distance: 100,
            x: 50,
            y: 50,
          },
        ],
        currentSettlement: null,
      },
      timing,
    );
    expect(farSettlements).toHaveLength(0);
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
        {
          biomeName: 'forest',
          proportion: 0.6,
          predominantDirections: ['north'],
        },
      ],
      [{ x: 5, y: 5, height: 0.8, distance: 5, direction: 'east' }],
      [
        {
          name: 'Town',
          type: 'town',
          size: 'large',
          distance: 0,
          direction: 'here',
        },
      ],
      { name: 'Town', type: 'town', intensity: 0.8 },
      timing,
      [
        {
          slackId: 'S1',
          name: 'Scout',
          distance: 2,
          direction: 'north',
        } as NearbyPlayerInfo,
      ],
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
        {
          biomeName: 'forest',
          proportion: 0.6,
          predominantDirections: ['north'],
        },
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
      {
        name: 'Town',
        type: 'town',
        size: 'large',
        intensity: 1,
        isCenter: true,
      },
      'desc',
      [],
      [],
    );

    expect(result.location.x).toBe(1);
    expect(result.inSettlement).toBe(true);
  });
});
