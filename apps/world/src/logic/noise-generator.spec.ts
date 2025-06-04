import { NoiseGenerator, WorldParameters } from './noise-generator';

describe('NoiseGenerator', () => {
  let generator: NoiseGenerator;
  let defaultParameters: WorldParameters;

  beforeEach(() => {
    defaultParameters = {
      heightNoise: {
        seed: 12345,
        scale: 0.01,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0
      },
      temperatureNoise: {
        seed: 54321,
        scale: 0.005,
        octaves: 3,
        persistence: 0.6,
        lacunarity: 2.0
      },
      moistureNoise: {
        seed: 98765,
        scale: 0.008,
        octaves: 3,
        persistence: 0.4,
        lacunarity: 2.0
      }
    };
    generator = new NoiseGenerator(defaultParameters);
  });

  describe('constructor', () => {
    it('should create a NoiseGenerator instance with valid parameters', () => {
      expect(generator).toBeInstanceOf(NoiseGenerator);
    });

    it('should create noise functions with different seeds', () => {
      const terrain1 = generator.generateTerrain(100, 100);
      
      // Create another generator with different seeds
      const differentParameters = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, seed: 99999 },
        temperatureNoise: { ...defaultParameters.temperatureNoise, seed: 11111 },
        moistureNoise: { ...defaultParameters.moistureNoise, seed: 22222 }
      };
      const generator2 = new NoiseGenerator(differentParameters);
      const terrain2 = generator2.generateTerrain(100, 100);

      // Different seeds should produce different results
      // Test multiple values to ensure at least one is different
      const isDifferent = 
        terrain1.height !== terrain2.height ||
        terrain1.temperature !== terrain2.temperature ||
        terrain1.moisture !== terrain2.moisture;
      
      expect(isDifferent).toBe(true);
    });
  });

  describe('generateTerrain', () => {
    it('should return terrain data with all required properties', () => {
      const terrain = generator.generateTerrain(100, 100);

      expect(terrain).toHaveProperty('height');
      expect(terrain).toHaveProperty('temperature');
      expect(terrain).toHaveProperty('moisture');
      expect(typeof terrain.height).toBe('number');
      expect(typeof terrain.temperature).toBe('number');
      expect(typeof terrain.moisture).toBe('number');
    });

    it('should return values between 0 and 1', () => {
      const terrain = generator.generateTerrain(100, 100);

      expect(terrain.height).toBeGreaterThanOrEqual(0);
      expect(terrain.height).toBeLessThanOrEqual(1);
      expect(terrain.temperature).toBeGreaterThanOrEqual(0);
      expect(terrain.temperature).toBeLessThanOrEqual(1);
      expect(terrain.moisture).toBeGreaterThanOrEqual(0);
      expect(terrain.moisture).toBeLessThanOrEqual(1);
    });

    it('should return consistent results for the same coordinates', () => {
      const terrain1 = generator.generateTerrain(50, 75);
      const terrain2 = generator.generateTerrain(50, 75);

      expect(terrain1.height).toBe(terrain2.height);
      expect(terrain1.temperature).toBe(terrain2.temperature);
      expect(terrain1.moisture).toBe(terrain2.moisture);
    });

    it('should return different results for different coordinates', () => {
      const terrain1 = generator.generateTerrain(0, 0);
      const terrain2 = generator.generateTerrain(100, 100);

      // With high probability, different coordinates should produce different values
      expect(
        terrain1.height !== terrain2.height ||
        terrain1.temperature !== terrain2.temperature ||
        terrain1.moisture !== terrain2.moisture
      ).toBe(true);
    });

    it('should handle negative coordinates', () => {
      const terrain = generator.generateTerrain(-50, -75);

      expect(terrain.height).toBeGreaterThanOrEqual(0);
      expect(terrain.height).toBeLessThanOrEqual(1);
      expect(terrain.temperature).toBeGreaterThanOrEqual(0);
      expect(terrain.temperature).toBeLessThanOrEqual(1);
      expect(terrain.moisture).toBeGreaterThanOrEqual(0);
      expect(terrain.moisture).toBeLessThanOrEqual(1);
    });

    it('should handle zero coordinates', () => {
      const terrain = generator.generateTerrain(0, 0);

      expect(terrain.height).toBeGreaterThanOrEqual(0);
      expect(terrain.height).toBeLessThanOrEqual(1);
      expect(terrain.temperature).toBeGreaterThanOrEqual(0);
      expect(terrain.temperature).toBeLessThanOrEqual(1);
      expect(terrain.moisture).toBeGreaterThanOrEqual(0);
      expect(terrain.moisture).toBeLessThanOrEqual(1);
    });

    it('should handle very large coordinates', () => {
      const terrain = generator.generateTerrain(1000000, 1000000);

      expect(terrain.height).toBeGreaterThanOrEqual(0);
      expect(terrain.height).toBeLessThanOrEqual(1);
      expect(terrain.temperature).toBeGreaterThanOrEqual(0);
      expect(terrain.temperature).toBeLessThanOrEqual(1);
      expect(terrain.moisture).toBeGreaterThanOrEqual(0);
      expect(terrain.moisture).toBeLessThanOrEqual(1);
    });
  });

  describe('generateChunkTerrain', () => {
    it('should generate terrain for an entire chunk', () => {
      const chunkSize = 16;
      const chunkTerrain = generator.generateChunkTerrain(0, 0, chunkSize);

      expect(chunkTerrain).toHaveLength(chunkSize);
      expect(chunkTerrain[0]).toHaveLength(chunkSize);

      // Check that all positions have valid terrain data
      for (let x = 0; x < chunkSize; x++) {
        for (let y = 0; y < chunkSize; y++) {
          const terrain = chunkTerrain[x][y];
          expect(terrain).toHaveProperty('height');
          expect(terrain).toHaveProperty('temperature');
          expect(terrain).toHaveProperty('moisture');
          expect(terrain.height).toBeGreaterThanOrEqual(0);
          expect(terrain.height).toBeLessThanOrEqual(1);
          expect(terrain.temperature).toBeGreaterThanOrEqual(0);
          expect(terrain.temperature).toBeLessThanOrEqual(1);
          expect(terrain.moisture).toBeGreaterThanOrEqual(0);
          expect(terrain.moisture).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should generate different terrain for different chunk positions', () => {
      const chunkSize = 4;
      const chunk1 = generator.generateChunkTerrain(0, 0, chunkSize);
      const chunk2 = generator.generateChunkTerrain(1, 1, chunkSize);

      // Find at least one different value between chunks
      let foundDifference = false;
      for (let x = 0; x < chunkSize && !foundDifference; x++) {
        for (let y = 0; y < chunkSize && !foundDifference; y++) {
          if (chunk1[x][y].height !== chunk2[x][y].height ||
              chunk1[x][y].temperature !== chunk2[x][y].temperature ||
              chunk1[x][y].moisture !== chunk2[x][y].moisture) {
            foundDifference = true;
          }
        }
      }
      expect(foundDifference).toBe(true);
    });

    it('should handle small chunk sizes', () => {
      const chunkTerrain = generator.generateChunkTerrain(0, 0, 1);
      
      expect(chunkTerrain).toHaveLength(1);
      expect(chunkTerrain[0]).toHaveLength(1);
      expect(chunkTerrain[0][0]).toHaveProperty('height');
      expect(chunkTerrain[0][0]).toHaveProperty('temperature');
      expect(chunkTerrain[0][0]).toHaveProperty('moisture');
    });

    it('should handle larger chunk sizes', () => {
      const chunkSize = 32;
      const chunkTerrain = generator.generateChunkTerrain(0, 0, chunkSize);
      
      expect(chunkTerrain).toHaveLength(chunkSize);
      expect(chunkTerrain[0]).toHaveLength(chunkSize);
    });

    it('should generate consistent results for the same chunk coordinates', () => {
      const chunkSize = 8;
      const chunk1 = generator.generateChunkTerrain(2, 3, chunkSize);
      const chunk2 = generator.generateChunkTerrain(2, 3, chunkSize);

      for (let x = 0; x < chunkSize; x++) {
        for (let y = 0; y < chunkSize; y++) {
          expect(chunk1[x][y].height).toBe(chunk2[x][y].height);
          expect(chunk1[x][y].temperature).toBe(chunk2[x][y].temperature);
          expect(chunk1[x][y].moisture).toBe(chunk2[x][y].moisture);
        }
      }
    });
  });

  describe('noise settings variations', () => {
    it('should produce different results with different scales', () => {
      const highScaleParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, scale: 0.1 }
      };
      const lowScaleParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, scale: 0.001 }
      };

      const highScaleGenerator = new NoiseGenerator(highScaleParams);
      const lowScaleGenerator = new NoiseGenerator(lowScaleParams);

      const terrain1 = highScaleGenerator.generateTerrain(100, 100);
      const terrain2 = lowScaleGenerator.generateTerrain(100, 100);

      expect(terrain1.height).not.toBe(terrain2.height);
    });

    it('should produce different results with different octave counts', () => {
      const highOctaveParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, octaves: 8 }
      };
      const lowOctaveParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, octaves: 1 }
      };

      const highOctaveGenerator = new NoiseGenerator(highOctaveParams);
      const lowOctaveGenerator = new NoiseGenerator(lowOctaveParams);

      const terrain1 = highOctaveGenerator.generateTerrain(100, 100);
      const terrain2 = lowOctaveGenerator.generateTerrain(100, 100);

      expect(terrain1.height).not.toBe(terrain2.height);
    });

    it('should produce different results with different persistence values', () => {
      const highPersistenceParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, persistence: 0.9 }
      };
      const lowPersistenceParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, persistence: 0.1 }
      };

      const highPersistenceGenerator = new NoiseGenerator(highPersistenceParams);
      const lowPersistenceGenerator = new NoiseGenerator(lowPersistenceParams);

      const terrain1 = highPersistenceGenerator.generateTerrain(100, 100);
      const terrain2 = lowPersistenceGenerator.generateTerrain(100, 100);

      expect(terrain1.height).not.toBe(terrain2.height);
    });

    it('should produce different results with different lacunarity values', () => {
      const highLacunarityParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, lacunarity: 3.0 }
      };
      const lowLacunarityParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, lacunarity: 1.5 }
      };

      const highLacunarityGenerator = new NoiseGenerator(highLacunarityParams);
      const lowLacunarityGenerator = new NoiseGenerator(lowLacunarityParams);

      const terrain1 = highLacunarityGenerator.generateTerrain(100, 100);
      const terrain2 = lowLacunarityGenerator.generateTerrain(100, 100);

      expect(terrain1.height).not.toBe(terrain2.height);
    });
  });

  describe('edge cases', () => {
    it('should handle zero octaves gracefully', () => {
      const zeroOctaveParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, octaves: 0 }
      };

      const zeroOctaveGenerator = new NoiseGenerator(zeroOctaveParams);
      const terrain = zeroOctaveGenerator.generateTerrain(100, 100);

      // With zero octaves, the noise function should return a default value (0.5)
      expect(terrain.height).toBe(0.5);
      expect(terrain.temperature).toBeGreaterThanOrEqual(0);
      expect(terrain.temperature).toBeLessThanOrEqual(1);
      expect(terrain.moisture).toBeGreaterThanOrEqual(0);
      expect(terrain.moisture).toBeLessThanOrEqual(1);
    });

    it('should handle very small scale values', () => {
      const smallScaleParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, scale: 0.0001 }
      };

      const smallScaleGenerator = new NoiseGenerator(smallScaleParams);
      const terrain = smallScaleGenerator.generateTerrain(100, 100);

      expect(terrain.height).toBeGreaterThanOrEqual(0);
      expect(terrain.height).toBeLessThanOrEqual(1);
    });

    it('should handle very large scale values', () => {
      const largeScaleParams = {
        ...defaultParameters,
        heightNoise: { ...defaultParameters.heightNoise, scale: 1.0 }
      };

      const largeScaleGenerator = new NoiseGenerator(largeScaleParams);
      const terrain = largeScaleGenerator.generateTerrain(100, 100);

      expect(terrain.height).toBeGreaterThanOrEqual(0);
      expect(terrain.height).toBeLessThanOrEqual(1);
    });
  });
});