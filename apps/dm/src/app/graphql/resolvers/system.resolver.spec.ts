jest.mock('@mud/database', () => ({
  Monster: class {},
  getPrismaClient: jest.fn(),
}));

import { SystemResolver } from './system.resolver';

describe('SystemResolver', () => {
  const createResolver = () => {
    const monsterService = {
      getMonstersAtLocation: jest.fn().mockResolvedValue([{ id: 1 }]),
      getAllMonsters: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      spawnMonster: jest
        .fn()
        .mockResolvedValue({ id: 3, name: 'Goblin', x: 1, y: 2 }),
    } as any;
    const gameTickService = {
      processTick: jest.fn().mockResolvedValue({ tick: 1 }),
      getGameState: jest.fn().mockResolvedValue({}),
    } as any;

    const resolver = new SystemResolver(monsterService, gameTickService);
    return { resolver, monsterService, gameTickService };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns health info', async () => {
    const { resolver } = createResolver();
    const result = await resolver.health();
    expect(result.status).toBe('healthy');
  });

  it('processes tick and handles error', async () => {
    const { resolver, gameTickService } = createResolver();
    const success = await resolver.processTick();
    expect(success.success).toBe(true);

    gameTickService.processTick.mockRejectedValueOnce(new Error('fail'));
    const failure = await resolver.processTick();
    expect(failure.success).toBe(false);
  });

  it('gets game state', async () => {
    const { resolver, monsterService, gameTickService } = createResolver();
    const success = await resolver.getGameState();
    expect(success.success).toBe(true);
    expect(monsterService.getAllMonsters).toHaveBeenCalled();

    gameTickService.getGameState.mockRejectedValueOnce(new Error('oops'));
    const failure = await resolver.getGameState();
    expect(failure.success).toBe(false);
  });

  it('fetches monsters and spawns with error handling', async () => {
    const { resolver, monsterService } = createResolver();
    await resolver.getMonstersAtLocation(1, 2);
    expect(monsterService.getMonstersAtLocation).toHaveBeenCalledWith(1, 2);

    await resolver.getAllMonsters();
    expect(monsterService.getAllMonsters).toHaveBeenCalled();

    const spawn = await resolver.spawnMonster({ x: 1, y: 2 } as any);
    expect(spawn.success).toBe(true);

    monsterService.spawnMonster.mockRejectedValueOnce(new Error('no spawn'));
    const failure = await resolver.spawnMonster({ x: 0, y: 0 } as any);
    expect(failure.success).toBe(false);
  });
});
