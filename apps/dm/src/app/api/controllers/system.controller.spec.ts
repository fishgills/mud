import { SystemController } from './system.controller';
import type { Monster } from '@mud/database';

const createMonsterService = () => ({
  getAllMonsters: jest.fn(),
  getMonstersAtLocation: jest.fn(),
  getMonsterById: jest.fn(),
  spawnMonster: jest.fn(),
});

const createGameTickService = () => ({
  processTick: jest.fn(),
  getGameState: jest.fn(),
});

const createPlayerService = () => ({
  hasActivePlayers: jest.fn(),
});

describe('SystemController', () => {
  let controller: SystemController;
  let monsterService: ReturnType<typeof createMonsterService>;
  let tickService: ReturnType<typeof createGameTickService>;
  let playerService: ReturnType<typeof createPlayerService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    monsterService = createMonsterService();
    tickService = createGameTickService();
    playerService = createPlayerService();
    controller = new SystemController(
      monsterService as never,
      tickService as never,
      playerService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns health status with timestamp', () => {
    expect(controller.health()).toEqual({
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  });

  it('validates minutesThreshold input for active players', async () => {
    playerService.hasActivePlayers.mockResolvedValue(true);
    const res = await controller.hasActivePlayers('15');
    expect(res).toEqual({ success: true, active: true, minutesThreshold: 15 });

    await expect(controller.hasActivePlayers('-1')).rejects.toThrow(
      'minutesThreshold must be a positive number',
    );
  });

  it('wraps processTick errors', async () => {
    tickService.processTick.mockResolvedValue({ processed: 1 });
    await expect(controller.processTick()).resolves.toEqual({
      success: true,
      result: { processed: 1 },
      message: 'Tick processed successfully',
    });
    tickService.processTick.mockRejectedValue(new Error('fail'));
    await expect(controller.processTick()).resolves.toEqual({
      success: false,
      message: 'fail',
    });
  });

  it('returns game state data and handles failures', async () => {
    tickService.getGameState.mockResolvedValue(undefined);
    monsterService.getAllMonsters.mockResolvedValue([{ id: 1 }] as Monster[]);
    const res = await controller.getGameState();
    expect(res.success).toBe(true);
    expect(res.data?.totalMonsters).toBe(1);

    tickService.getGameState.mockRejectedValue(new Error('error'));
    await expect(controller.getGameState()).resolves.toEqual({
      success: false,
      message: 'error',
    });
  });

  it('fetches monsters optionally by coordinates', async () => {
    const monsters = [{ id: 1 }] as Monster[];
    monsterService.getAllMonsters.mockResolvedValue(monsters);
    expect(await controller.getMonsters()).toBe(monsters);

    monsterService.getMonstersAtLocation.mockResolvedValue(monsters);
    expect(await controller.getMonsters('5', '6')).toBe(monsters);

    await expect(controller.getMonsters('a', '2')).rejects.toThrow(
      'x and y must be numeric when provided',
    );
  });

  it('validates monster id and spawn input', async () => {
    await expect(controller.getMonsterById('abc')).rejects.toThrow(
      'id must be a numeric value',
    );
    monsterService.getMonsterById.mockResolvedValue({ id: 2 } as Monster);
    expect(await controller.getMonsterById('2')).toEqual({ id: 2 });

    await expect(
      controller.spawnMonster({ x: NaN, y: 0 } as any),
    ).rejects.toThrow('x and y must be provided as numbers');

    const spawned = { id: 5, name: 'Goblin' } as Monster;
    monsterService.spawnMonster.mockResolvedValue(spawned);
    await expect(controller.spawnMonster({ x: 1, y: 2 } as any)).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: spawned,
        message: expect.stringContaining('Spawned'),
      }),
    );

    monsterService.spawnMonster.mockRejectedValue(new Error('boom'));
    await expect(controller.spawnMonster({ x: 1, y: 2 } as any)).resolves.toEqual(
      expect.objectContaining({ success: false, message: 'boom' }),
    );
  });
});
