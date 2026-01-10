import {
  MonsterVariant,
  VARIANT_CONFIGS,
  rollMonsterVariant,
  getMonsterDisplayName,
  formatMonsterNameWithVariant,
  MONSTER_TEMPLATES,
  getMonsterTemplate,
  pickTypeForBiome,
  BIOME_SPAWN_TABLE,
} from './monster.types';

describe('Monster Templates', () => {
  it('should have at least 50 monster templates', () => {
    expect(MONSTER_TEMPLATES.length).toBeGreaterThanOrEqual(50);
  });

  it('should have unique type identifiers', () => {
    const types = MONSTER_TEMPLATES.map((t) => t.type);
    const uniqueTypes = new Set(types);
    expect(uniqueTypes.size).toBe(types.length);
  });

  it('should have difficulty levels between 1 and 10', () => {
    for (const template of MONSTER_TEMPLATES) {
      expect(template.difficulty).toBeGreaterThanOrEqual(1);
      expect(template.difficulty).toBeLessThanOrEqual(10);
    }
  });

  it('should have positive base stats', () => {
    for (const template of MONSTER_TEMPLATES) {
      expect(template.baseHp).toBeGreaterThan(0);
      expect(template.strength).toBeGreaterThan(0);
      expect(template.agility).toBeGreaterThan(0);
      expect(template.health).toBeGreaterThan(0);
    }
  });

  it('should have valid damage rolls', () => {
    const dicePattern = /^\d+d\d+$/;
    for (const template of MONSTER_TEMPLATES) {
      expect(template.damageRoll).toMatch(dicePattern);
    }
  });
});

describe('Monster Variant System', () => {
  describe('VARIANT_CONFIGS', () => {
    it('should have configurations for all variants', () => {
      expect(VARIANT_CONFIGS[MonsterVariant.FEEBLE]).toBeDefined();
      expect(VARIANT_CONFIGS[MonsterVariant.NORMAL]).toBeDefined();
      expect(VARIANT_CONFIGS[MonsterVariant.FIERCE]).toBeDefined();
    });

    it('should have correct stat multipliers', () => {
      expect(VARIANT_CONFIGS[MonsterVariant.FEEBLE].statMultiplier).toBe(0.7);
      expect(VARIANT_CONFIGS[MonsterVariant.NORMAL].statMultiplier).toBe(1.0);
      expect(VARIANT_CONFIGS[MonsterVariant.FIERCE].statMultiplier).toBe(1.4);
    });

    it('should have labels only for non-normal variants', () => {
      expect(VARIANT_CONFIGS[MonsterVariant.FEEBLE].label).toBe('Feeble');
      expect(VARIANT_CONFIGS[MonsterVariant.NORMAL].label).toBe('');
      expect(VARIANT_CONFIGS[MonsterVariant.FIERCE].label).toBe('Fierce');
    });
  });

  describe('rollMonsterVariant', () => {
    it('should return a valid variant', () => {
      for (let i = 0; i < 100; i++) {
        const variant = rollMonsterVariant();
        expect(Object.values(MonsterVariant)).toContain(variant);
      }
    });

    it('should return normal variant most often (mocked test)', () => {
      // Mock Math.random to return middle value
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.5);

      const variant = rollMonsterVariant();
      expect(variant).toBe(MonsterVariant.NORMAL);

      Math.random = originalRandom;
    });

    it('should return feeble variant for low rolls', () => {
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.1); // Less than 0.15

      const variant = rollMonsterVariant();
      expect(variant).toBe(MonsterVariant.FEEBLE);

      Math.random = originalRandom;
    });

    it('should return fierce variant for high rolls', () => {
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.9); // Greater than 0.85

      const variant = rollMonsterVariant();
      expect(variant).toBe(MonsterVariant.FIERCE);

      Math.random = originalRandom;
    });
  });

  describe('getMonsterDisplayName', () => {
    it('should return base name for normal variant', () => {
      const result = getMonsterDisplayName('Goblin', MonsterVariant.NORMAL);
      expect(result).toBe('Goblin');
    });

    it('should prefix name for feeble variant', () => {
      const result = getMonsterDisplayName('Goblin', MonsterVariant.FEEBLE);
      expect(result).toBe('Feeble Goblin');
    });

    it('should prefix name for fierce variant', () => {
      const result = getMonsterDisplayName('Goblin', MonsterVariant.FIERCE);
      expect(result).toBe('Fierce Goblin');
    });
  });

  describe('formatMonsterNameWithVariant', () => {
    it('should return base name for normal variant without color', () => {
      const result = formatMonsterNameWithVariant(
        'Wolf',
        MonsterVariant.NORMAL,
      );
      expect(result).toBe('Wolf');
    });

    it('should add italic formatting for feeble variant with color', () => {
      const result = formatMonsterNameWithVariant(
        'Wolf',
        MonsterVariant.FEEBLE,
        { useColor: true },
      );
      expect(result).toBe('_Feeble Wolf_');
    });

    it('should add bold formatting for fierce variant with color', () => {
      const result = formatMonsterNameWithVariant(
        'Wolf',
        MonsterVariant.FIERCE,
        { useColor: true },
      );
      expect(result).toBe('*Fierce Wolf*');
    });

    it('should return plain name without color option', () => {
      const result = formatMonsterNameWithVariant(
        'Wolf',
        MonsterVariant.FIERCE,
        { useColor: false },
      );
      expect(result).toBe('Fierce Wolf');
    });
  });
});

describe('Monster Template Lookup', () => {
  it('should find template by type', () => {
    const template = getMonsterTemplate('goblin');
    expect(template).toBeDefined();
    expect(template.name).toBe('Goblin');
  });

  it('should fall back to goblin for unknown type', () => {
    const template = getMonsterTemplate('unknown-monster');
    expect(template.type).toBe('goblin');
  });
});

describe('Biome Spawn Tables', () => {
  it('should have spawn tables for common biomes', () => {
    const expectedBiomes = [
      'grassland',
      'plains',
      'forest',
      'desert',
      'swamp',
      'mountain',
      'jungle',
    ];

    for (const biome of expectedBiomes) {
      expect(BIOME_SPAWN_TABLE[biome]).toBeDefined();
      expect(BIOME_SPAWN_TABLE[biome].length).toBeGreaterThan(0);
    }
  });

  it('should pick a valid monster type for a biome', () => {
    const type = pickTypeForBiome('forest');
    expect(typeof type).toBe('string');
    expect(type.length).toBeGreaterThan(0);
  });

  it('should pick from fallback for unknown biome', () => {
    const type = pickTypeForBiome('unknownbiome');
    expect(typeof type).toBe('string');
    expect(type.length).toBeGreaterThan(0);
  });
});
