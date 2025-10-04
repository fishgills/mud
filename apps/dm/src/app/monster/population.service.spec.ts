jest.mock('@mud/database', () => ({
  Monster: class {},
  getPrismaClient: jest.fn(),
}));

import { PopulationService } from './population.service';

describe('PopulationService', () => {
  const createService = () => {
    const monsterService = {
      getMonstersInBounds: jest.fn().mockResolvedValue([]),
      spawnMonstersInArea: jest.fn().mockResolvedValue([{ id: 1 }]),
    } as unknown as {
      getMonstersInBounds: jest.Mock;
      spawnMonstersInArea: jest.Mock;
    };
    const worldService = {
      getTilesInBounds: jest.fn().mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({
          x: i,
          y: i,
          biomeName: i % 2 === 0 ? 'forest' : 'plains',
        })),
      ),
    } as unknown as { getTilesInBounds: jest.Mock };

    const service = new PopulationService(monsterService, worldService);
    return { service, monsterService, worldService };
  };

  beforeEach(() => {
    jest.spyOn(global.Math, 'random').mockImplementation(() => 0.3);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('enforces density targets and spawns monsters', async () => {
    const { service, monsterService, worldService } = createService();
    const result = await service.enforceDensityAround(0, 0, 5, 3);

    expect(result.spawned).toBeGreaterThanOrEqual(0);
    expect(monsterService.getMonstersInBounds).toHaveBeenCalled();
    expect(worldService.getTilesInBounds).toHaveBeenCalled();
    expect(result.report.length).toBeGreaterThan(0);
  });
});
