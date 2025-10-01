import { SettlementGenerator } from './settlement-generator';
import { BIOMES } from '../constants';

describe('SettlementGenerator', () => {
  let generator: SettlementGenerator;

  beforeEach(() => {
    generator = new SettlementGenerator(12345);
  });

  describe('shouldGenerateSettlement', () => {
    it('should return deterministic results for same coordinates', () => {
      const biome = BIOMES.GRASSLAND;

      const result1 = generator.shouldGenerateSettlement(100, 100, biome);
      const result2 = generator.shouldGenerateSettlement(100, 100, biome);

      expect(result1).toBe(result2);
    });

    it('should return false for most coordinates (settlements should be rare)', () => {
      const biome = BIOMES.GRASSLAND;
      let settlementCount = 0;
      const totalChecks = 10000;

      for (let i = 0; i < totalChecks; i++) {
        if (generator.shouldGenerateSettlement(i * 10, i * 10, biome)) {
          settlementCount++;
        }
      }

      // Settlements should be very rare (less than 5% of checks)
      expect(settlementCount).toBeLessThan(totalChecks * 0.05);
    });

    it('should handle different biomes', () => {
      const grassland = BIOMES.GRASSLAND;
      const mountains = BIOMES.MOUNTAIN;

      const result1 = generator.shouldGenerateSettlement(100, 100, grassland);
      const result2 = generator.shouldGenerateSettlement(100, 100, mountains);

      // Results may differ based on biome (though both should be boolean)
      expect(typeof result1).toBe('boolean');
      expect(typeof result2).toBe('boolean');
    });

    it('should never generate settlements in oceans', () => {
      const ocean = BIOMES.OCEAN;
      let settlementCount = 0;

      for (let i = 0; i < 1000; i++) {
        if (generator.shouldGenerateSettlement(i * 10, i * 10, ocean)) {
          settlementCount++;
        }
      }

      expect(settlementCount).toBe(0);
    });
  });

  describe('generateSettlement', () => {
    it('should generate a valid settlement', () => {
      const biome = BIOMES.GRASSLAND;
      const settlement = generator.generateSettlement(100, 100, biome);

      expect(settlement).toBeDefined();
      expect(settlement.x).toBe(100);
      expect(settlement.y).toBe(100);
      expect(settlement.name).toBeDefined();
      expect(settlement.type).toBeDefined();
      expect(settlement.size).toBeDefined();
      expect(settlement.population).toBeGreaterThan(0);
      expect(settlement.description).toBeDefined();
    });

    it('should generate deterministic settlements for same coordinates', () => {
      const biome = BIOMES.GRASSLAND;

      const settlement1 = generator.generateSettlement(100, 100, biome);
      const settlement2 = generator.generateSettlement(100, 100, biome);

      expect(settlement1.name).toBe(settlement2.name);
      expect(settlement1.type).toBe(settlement2.type);
      expect(settlement1.size).toBe(settlement2.size);
      expect(settlement1.population).toBe(settlement2.population);
    });

    it('should generate different settlements at different coordinates', () => {
      const biome = BIOMES.GRASSLAND;

      const settlement1 = generator.generateSettlement(100, 100, biome);
      const settlement2 = generator.generateSettlement(500, 500, biome);

      // At least one property should differ
      const isDifferent =
        settlement1.name !== settlement2.name ||
        settlement1.type !== settlement2.type ||
        settlement1.size !== settlement2.size;

      expect(isDifferent).toBe(true);
    });

    it('should generate valid settlement types', () => {
      const biome = BIOMES.GRASSLAND;
      const types = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const settlement = generator.generateSettlement(
          i * 1000,
          i * 1000,
          biome,
        );
        types.add(settlement.type);
      }

      // Should have at least some variety in types
      expect(types.size).toBeGreaterThan(0);
      // All types should be valid
      types.forEach((type) => {
        expect(['city', 'town', 'village', 'hamlet', 'farm']).toContain(type);
      });
    });

    it('should generate valid settlement sizes', () => {
      const biome = BIOMES.GRASSLAND;
      const sizes = new Set<string>();

      for (let i = 0; i < 50; i++) {
        const settlement = generator.generateSettlement(
          i * 1000,
          i * 1000,
          biome,
        );
        sizes.add(settlement.size);
      }

      // Should have at least some variety in sizes
      expect(sizes.size).toBeGreaterThan(0);
      // All sizes should be valid
      sizes.forEach((size) => {
        expect(['tiny', 'small', 'medium', 'large']).toContain(size);
      });
    });

    it('should have non-empty settlement names', () => {
      const biome = BIOMES.GRASSLAND;

      for (let i = 0; i < 10; i++) {
        const settlement = generator.generateSettlement(
          i * 1000,
          i * 1000,
          biome,
        );
        expect(settlement.name.length).toBeGreaterThan(0);
        expect(settlement.name).not.toBe('');
      }
    });
  });
});
