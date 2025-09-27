import { NoiseGenerator } from './noise-generator';
import { WorldSeedConfig } from '../world/types';
import { createNoise2D } from 'simplex-noise';

const mockHeightNoise = jest.fn();
const mockTemperatureNoise = jest.fn();
const mockMoistureNoise = jest.fn();

jest.mock('simplex-noise', () => ({
  createNoise2D: jest.fn(),
}));

jest.mock('seedrandom', () => jest.fn(() => () => 0.42));

describe('NoiseGenerator', () => {
  const config: WorldSeedConfig = {
    heightSeed: 1,
    temperatureSeed: 2,
    moistureSeed: 3,
    heightConfig: { scale: 1, octaves: 1, persistence: 0.5, lacunarity: 2 },
    temperatureConfig: {
      scale: 1,
      octaves: 1,
      persistence: 0.5,
      lacunarity: 2,
    },
    moistureConfig: { scale: 1, octaves: 1, persistence: 0.5, lacunarity: 2 },
  };

  beforeEach(() => {
    (createNoise2D as jest.Mock).mockReset();
    (createNoise2D as jest.Mock)
      .mockImplementationOnce(() => mockHeightNoise)
      .mockImplementationOnce(() => mockTemperatureNoise)
      .mockImplementationOnce(() => mockMoistureNoise);
    mockHeightNoise.mockReset();
    mockTemperatureNoise.mockReset();
    mockMoistureNoise.mockReset();
  });

  it('normalizes height values into the 0-1 range', () => {
    mockHeightNoise.mockReturnValue(0.5);
    const generator = new NoiseGenerator(config);

    expect(generator.generateHeight(10, 20)).toBeCloseTo(0.75, 5);
    expect(mockHeightNoise).toHaveBeenCalledWith(10, 20);
  });

  it('applies latitude factor and clamps temperature', () => {
    mockTemperatureNoise.mockReturnValue(1);
    const generator = new NoiseGenerator(config);

    expect(generator.generateTemperature(5, 100)).toBeCloseTo(0.95, 5);

    mockTemperatureNoise.mockReturnValue(-1);
    expect(generator.generateTemperature(5, 900)).toBe(0);
  });

  it('generates moisture using seeded noise', () => {
    mockMoistureNoise.mockReturnValue(0);
    const generator = new NoiseGenerator(config);

    expect(generator.generateMoisture(7, 3)).toBeCloseTo(0.5, 5);
    expect(mockMoistureNoise).toHaveBeenCalledWith(7, 3);
  });
});
