import { BIOMES } from '../constants';
import { ChunkGeneratorService } from './chunk-generator.service';
import { WorldUtilsService } from './world-utils.service';
import { BiomeGenerator } from '../biome-generator/biome-generator';

const mockGenerateHeight = jest.fn();
const mockGenerateTemperature = jest.fn();
const mockGenerateMoisture = jest.fn();

jest.mock('../noise-generator/noise-generator', () => ({
  NoiseGenerator: jest.fn().mockImplementation(() => ({
    generateHeight: mockGenerateHeight,
    generateTemperature: mockGenerateTemperature,
    generateMoisture: mockGenerateMoisture,
  })),
}));

const mockShouldGenerateSettlement = jest.fn();
const mockGenerateSettlement = jest.fn();

jest.mock('../settlement-generator/settlement-generator', () => ({
  SettlementGenerator: jest.fn().mockImplementation(() => ({
    shouldGenerateSettlement: mockShouldGenerateSettlement,
    generateSettlement: mockGenerateSettlement,
  })),
}));

describe('ChunkGeneratorService', () => {
  let worldUtils: Pick<WorldUtilsService, 'checkSettlementOverlap'>;
  let service: ChunkGeneratorService;
  let biomeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    worldUtils = {
      checkSettlementOverlap: jest.fn().mockReturnValue(false),
    };
    service = new ChunkGeneratorService(worldUtils as WorldUtilsService);

    mockGenerateHeight.mockReturnValue(0.4);
    mockGenerateTemperature.mockReturnValue(0.5);
    mockGenerateMoisture.mockReturnValue(0.6);

    biomeSpy = jest
      .spyOn(BiomeGenerator, 'determineBiome')
      .mockReturnValue(BIOMES.GRASSLAND);

    const settlement = {
      id: 1,
      name: 'Test',
      type: 'village',
      size: 'small',
      population: 200,
      x: 0,
      y: 0,
      description: 'desc',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockGenerateSettlement.mockReturnValue(settlement);
    mockShouldGenerateSettlement.mockImplementation(
      (x: number, y: number) => x === 0 && y === 0,
    );
  });

  afterEach(() => {
    biomeSpy.mockRestore();
  });

  it('generates chunk tiles with aggregated stats and settlements', () => {
    const result = service.generateChunk(0, 0, 42);

    const expectedTiles =
      WorldUtilsService.CHUNK_SIZE * WorldUtilsService.CHUNK_SIZE;

    expect(result.tiles).toHaveLength(expectedTiles);
    expect(result.settlements).toHaveLength(1);
    expect(result.settlements[0].name).toBe('Test');
    expect(result.stats.biomes).toEqual({
      [BIOMES.GRASSLAND.name]: expectedTiles,
    });
    expect(result.stats.averageHeight).toBeCloseTo(0.4, 5);
    expect(result.stats.averageTemperature).toBeCloseTo(0.5, 5);
    expect(result.stats.averageMoisture).toBeCloseTo(0.6, 5);
  });

  it('generates a deterministic tile with seeded coordinates', () => {
    mockShouldGenerateSettlement.mockReturnValue(false);

    const tile = service.generateTileAt(5, 7, 100);

    expect(tile.id).toBeGreaterThan(0);
    expect(tile.x).toBe(5);
    expect(tile.y).toBe(7);
    expect(tile.biomeName).toBe(BIOMES.GRASSLAND.name);
    expect(tile.chunkX).toBe(Math.floor(5 / WorldUtilsService.CHUNK_SIZE));
    expect(tile.chunkY).toBe(Math.floor(7 / WorldUtilsService.CHUNK_SIZE));
  });

  it('avoids adding settlements when overlap is detected', () => {
    (worldUtils.checkSettlementOverlap as jest.Mock).mockReturnValueOnce(true);

    const result = service.generateChunk(0, 0, 12);

    expect(result.settlements).toHaveLength(0);
    expect(mockGenerateSettlement).not.toHaveBeenCalled();
  });
});
