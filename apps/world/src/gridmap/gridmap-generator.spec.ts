import { GridMapGenerator } from './gridmap-generator';
import type { GridBiome, GridConfig, GridConfigLight } from './interfaces';

const baseHeightConfig: GridConfig = {
  width: 10,
  height: 10,
  frequency: 1,
  tilesize: 1,
  gap: 0,
  octaves: 1,
};

const baseMoistureConfig: GridConfigLight = {
  frequency: 1,
  octaves: 1,
};

const fallbackBiome: GridBiome = {
  coordinates: [
    { x: -1, y: -1 },
    { x: 1, y: 1 },
  ],
  color: '#111111',
  name: 'fallback',
  id: 0,
};

const overlappingBiome: GridBiome = {
  coordinates: [
    { x: -0.5, y: -0.5 },
    { x: 0.5, y: 0.5 },
  ],
  color: '#222222',
  name: 'target',
  id: 1,
};

describe('GridMapGenerator', () => {
  it('normalizes tile samples and prefers the most specific matching biome', () => {
    const generator = new GridMapGenerator(
      { ...baseHeightConfig },
      { ...baseMoistureConfig },
      [fallbackBiome, overlappingBiome],
    );

    Object.assign(generator as unknown as Record<string, unknown>, {
      heightNoise: jest.fn(() => 0.1),
      moistureNoise: jest.fn(() => 0.1),
    });

    const tile = generator.sampleTile(4, 8);

    expect(tile.rawHeight).toBeCloseTo(0.1, 5);
    expect(tile.height).toBeCloseTo(0.55, 5);
    expect(tile.rawMoisture).toBeCloseTo(0.1, 5);
    expect(tile.moisture).toBeCloseTo(0.55, 5);
    expect(tile.biome).toBe(overlappingBiome);
  });

  it('falls back to the first biome when no candidates match', () => {
    const generator = new GridMapGenerator(
      { ...baseHeightConfig },
      { ...baseMoistureConfig },
      [fallbackBiome, overlappingBiome],
    );

    Object.assign(generator as unknown as Record<string, unknown>, {
      heightNoise: jest.fn(() => 0.9),
      moistureNoise: jest.fn(() => 0.9),
    });

    const tile = generator.sampleTile(0, 0);

    expect(tile.biome).toBe(fallbackBiome);
  });

  it('produces deterministic samples for the same seed', () => {
    const biomes: GridBiome[] = [fallbackBiome];
    const generatorA = new GridMapGenerator(
      { ...baseHeightConfig },
      { ...baseMoistureConfig },
      biomes,
      42,
    );
    const generatorB = new GridMapGenerator(
      { ...baseHeightConfig },
      { ...baseMoistureConfig },
      biomes,
      42,
    );

    const tileA = generatorA.sampleTile(10, -5);
    const tileB = generatorB.sampleTile(10, -5);

    expect(tileA.rawHeight).toBeCloseTo(tileB.rawHeight, 5);
    expect(tileA.rawMoisture).toBeCloseTo(tileB.rawMoisture, 5);
    expect(tileA.biome).toEqual(tileB.biome);
  });
});
