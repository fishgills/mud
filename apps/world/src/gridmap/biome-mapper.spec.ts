import { BIOMES } from '../constants';
import { mapGridBiomeToBiomeInfo } from './biome-mapper';
import type { GridBiome } from './interfaces';

describe('mapGridBiomeToBiomeInfo', () => {
  const baseBiome: GridBiome = {
    coordinates: [
      { x: -1, y: -1 },
      { x: 1, y: 1 },
    ],
    color: '#000000',
    name: 'forest',
    id: 0,
  };

  it('maps known grid biome names to world biome info', () => {
    const biomeInfo = mapGridBiomeToBiomeInfo(baseBiome);

    expect(biomeInfo).toEqual(BIOMES.FOREST);
  });

  it('treats grid biome names case-insensitively', () => {
    const biomeInfo = mapGridBiomeToBiomeInfo({ ...baseBiome, name: 'FoReSt' });

    expect(biomeInfo).toEqual(BIOMES.FOREST);
  });

  it('falls back to grassland when no mapping exists', () => {
    const biomeInfo = mapGridBiomeToBiomeInfo({
      ...baseBiome,
      name: 'unknown-biome',
    });

    expect(biomeInfo).toEqual(BIOMES.GRASSLAND);
  });

  it('maps mountain biome names correctly', () => {
    const biomeInfo = mapGridBiomeToBiomeInfo({
      ...baseBiome,
      name: 'mountain',
    });

    expect(biomeInfo).toEqual(BIOMES.MOUNTAIN);
  });
});
