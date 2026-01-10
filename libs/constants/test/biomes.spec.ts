import {
  BiomeId,
  BIOMES,
  ALL_BIOME_IDS,
  WATER_BIOME_IDS,
  isWaterBiome,
  getBiomeById,
  getBiomeByName,
  getBiomeIdByName,
  BIOME_NAME_TO_ID,
  BIOMES_BY_KEY,
} from '../src/biomes';

describe('BiomeId enum', () => {
  it('contains 18 biomes', () => {
    expect(ALL_BIOME_IDS).toHaveLength(18);
  });

  it('has sequential IDs starting at 1', () => {
    expect(BiomeId.OCEAN).toBe(1);
    expect(BiomeId.VOLCANIC).toBe(18);
  });
});

describe('BIOMES', () => {
  it('has all 18 biome definitions', () => {
    expect(Object.keys(BIOMES)).toHaveLength(18);
  });

  it('has matching IDs for each biome', () => {
    for (const id of ALL_BIOME_IDS) {
      const biome = BIOMES[id];
      expect(biome).toBeDefined();
      expect(biome.id).toBe(id);
    }
  });

  it('contains expected biome properties', () => {
    const forest = BIOMES[BiomeId.FOREST];
    expect(forest).toEqual({
      id: BiomeId.FOREST,
      name: 'Forest',
      description: 'Dense woodland',
      color: '#3b8632',
      ascii: 'T',
    });
  });
});

describe('WATER_BIOME_IDS', () => {
  it('contains 4 water biomes', () => {
    expect(WATER_BIOME_IDS).toHaveLength(4);
    expect(WATER_BIOME_IDS).toContain(BiomeId.OCEAN);
    expect(WATER_BIOME_IDS).toContain(BiomeId.SHALLOW_OCEAN);
    expect(WATER_BIOME_IDS).toContain(BiomeId.LAKE);
    expect(WATER_BIOME_IDS).toContain(BiomeId.RIVER);
  });
});

describe('isWaterBiome', () => {
  describe('with BiomeId', () => {
    it('returns true for water biomes', () => {
      expect(isWaterBiome(BiomeId.OCEAN)).toBe(true);
      expect(isWaterBiome(BiomeId.SHALLOW_OCEAN)).toBe(true);
      expect(isWaterBiome(BiomeId.LAKE)).toBe(true);
      expect(isWaterBiome(BiomeId.RIVER)).toBe(true);
    });

    it('returns false for land biomes', () => {
      expect(isWaterBiome(BiomeId.FOREST)).toBe(false);
      expect(isWaterBiome(BiomeId.DESERT)).toBe(false);
      expect(isWaterBiome(BiomeId.MOUNTAIN)).toBe(false);
    });
  });

  describe('with string (backwards compatibility)', () => {
    it('returns true for water biome names', () => {
      expect(isWaterBiome('Ocean')).toBe(true);
      expect(isWaterBiome('shallow ocean')).toBe(true);
      expect(isWaterBiome('mysterious LAKE shore')).toBe(true);
      expect(isWaterBiome('frozen riverbank')).toBe(true);
      expect(isWaterBiome('Water Gardens')).toBe(true);
    });

    it('returns false for land biome names', () => {
      expect(isWaterBiome('Forest')).toBe(false);
      expect(isWaterBiome('Desert Oasis')).toBe(false);
      expect(isWaterBiome('mountain')).toBe(false);
    });

    it('returns false for nullish or empty values', () => {
      expect(isWaterBiome(null)).toBe(false);
      expect(isWaterBiome(undefined)).toBe(false);
      expect(isWaterBiome('')).toBe(false);
      expect(isWaterBiome('   ')).toBe(false);
    });
  });
});

describe('getBiomeById', () => {
  it('returns biome info for valid ID', () => {
    const biome = getBiomeById(BiomeId.GRASSLAND);
    expect(biome.name).toBe('Grassland');
  });
});

describe('getBiomeByName', () => {
  it('finds biome by exact name (case insensitive)', () => {
    const biome = getBiomeByName('forest');
    expect(biome?.id).toBe(BiomeId.FOREST);
  });

  it('finds biome with spaces in name', () => {
    const biome = getBiomeByName('snowy mountain');
    expect(biome?.id).toBe(BiomeId.SNOWY_MOUNTAIN);
  });

  it('returns undefined for unknown name', () => {
    const biome = getBiomeByName('unknown');
    expect(biome).toBeUndefined();
  });
});

describe('getBiomeIdByName', () => {
  it('returns BiomeId for valid name', () => {
    expect(getBiomeIdByName('Desert')).toBe(BiomeId.DESERT);
  });

  it('returns undefined for unknown name', () => {
    expect(getBiomeIdByName('unknown')).toBeUndefined();
  });
});

describe('BIOME_NAME_TO_ID', () => {
  it('maps lowercase names to IDs', () => {
    expect(BIOME_NAME_TO_ID['forest']).toBe(BiomeId.FOREST);
    expect(BIOME_NAME_TO_ID['shallow ocean']).toBe(BiomeId.SHALLOW_OCEAN);
  });
});

describe('BIOMES_BY_KEY', () => {
  it('provides legacy uppercase key format', () => {
    expect(BIOMES_BY_KEY['FOREST'].name).toBe('Forest');
    expect(BIOMES_BY_KEY['SNOWY_MOUNTAIN'].name).toBe('Snowy Mountain');
  });
});
