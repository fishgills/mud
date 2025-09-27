import { isWaterBiome } from './biome.util';

describe('isWaterBiome', () => {
  it('returns false for nullish or empty values', () => {
    expect(isWaterBiome(undefined)).toBe(false);
    expect(isWaterBiome(null)).toBe(false);
    expect(isWaterBiome('')).toBe(false);
    expect(isWaterBiome('   ')).toBe(false);
  });

  it('detects common watery biome keywords', () => {
    expect(isWaterBiome('Ocean')).toBe(true);
    expect(isWaterBiome('mysterious LAKE shore')).toBe(true);
    expect(isWaterBiome('frozen riverbank')).toBe(true);
    expect(isWaterBiome('Water Gardens')).toBe(true);
  });

  it('returns false for land biomes', () => {
    expect(isWaterBiome('Forest')).toBe(false);
    expect(isWaterBiome('Desert Oasis')).toBe(false);
  });
});
