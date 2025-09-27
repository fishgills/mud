import { BIOMES } from '../constants';
import { BiomeGenerator } from './biome-generator';

describe('BiomeGenerator.determineBiome', () => {
  it('classifies deep and shallow water tiles', () => {
    expect(BiomeGenerator.determineBiome(0.05, 0.5, 0.5)).toBe(BIOMES.OCEAN);
    expect(BiomeGenerator.determineBiome(0.15, 0.5, 0.5)).toBe(
      BIOMES.SHALLOW_OCEAN,
    );
    expect(BiomeGenerator.determineBiome(0.22, 0.5, 0.5)).toBe(BIOMES.BEACH);
  });

  it('handles mountainous elevation and volcanic regions', () => {
    expect(BiomeGenerator.determineBiome(0.85, 0.2, 0.4)).toBe(
      BIOMES.SNOWY_MOUNTAIN,
    );
    expect(BiomeGenerator.determineBiome(0.92, 0.8, 0.4)).toBe(BIOMES.VOLCANIC);
    expect(BiomeGenerator.determineBiome(0.82, 0.6, 0.4)).toBe(BIOMES.MOUNTAIN);
  });

  it('chooses hill variants based on temperature range', () => {
    expect(BiomeGenerator.determineBiome(0.65, 0.7, 0.3)).toBe(BIOMES.HILLS);
    expect(BiomeGenerator.determineBiome(0.65, 0.2, 0.3)).toBe(BIOMES.ALPINE);
  });

  it('identifies freshwater lakes in moist mid-elevations', () => {
    expect(BiomeGenerator.determineBiome(0.3, 0.5, 0.9)).toBe(BIOMES.LAKE);
  });

  it('distinguishes cold climate biomes', () => {
    expect(BiomeGenerator.determineBiome(0.4, 0.2, 0.7)).toBe(BIOMES.TAIGA);
    expect(BiomeGenerator.determineBiome(0.4, 0.2, 0.2)).toBe(BIOMES.TUNDRA);
  });

  it('distinguishes hot climate biomes', () => {
    expect(BiomeGenerator.determineBiome(0.4, 0.8, 0.2)).toBe(BIOMES.DESERT);
    expect(BiomeGenerator.determineBiome(0.4, 0.8, 0.8)).toBe(BIOMES.JUNGLE);
    expect(BiomeGenerator.determineBiome(0.4, 0.8, 0.5)).toBe(BIOMES.SAVANNA);
  });

  it('covers temperate moisture gradients', () => {
    expect(BiomeGenerator.determineBiome(0.4, 0.5, 0.85)).toBe(BIOMES.SWAMP);
    expect(BiomeGenerator.determineBiome(0.4, 0.5, 0.65)).toBe(BIOMES.FOREST);
    expect(BiomeGenerator.determineBiome(0.4, 0.5, 0.5)).toBe(BIOMES.GRASSLAND);
    expect(BiomeGenerator.determineBiome(0.4, 0.5, 0.1)).toBe(BIOMES.DESERT);
  });
});

describe('BiomeGenerator.generateTileDescription', () => {
  it('returns a descriptive summary incorporating biome and modifiers', () => {
    const description = BiomeGenerator.generateTileDescription(
      BIOMES.FOREST,
      0.85,
      0.75,
      0.2,
    );

    expect(description).toContain(BIOMES.FOREST.description);
    expect(description).toContain('elevated');
    expect(description).toContain('hot');
    expect(description).toContain('dry');
  });
});
