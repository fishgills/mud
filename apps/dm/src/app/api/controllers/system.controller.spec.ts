import { SystemController } from './system.controller';
import type { Monster } from '@mud/database';

const createMonsterService = () => ({
  getAllMonsters: jest.fn(),
  getMonsterById: jest.fn(),
  spawnMonster: jest.fn(),
});

const createPlayerService = () => ({
  hasActivePlayers: jest.fn(),
});

describe('SystemController', () => {
  let controller: SystemController;
  let monsterService: ReturnType<typeof createMonsterService>;
  let playerService: ReturnType<typeof createPlayerService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    monsterService = createMonsterService();
    playerService = createPlayerService();
    controller = new SystemController(
      monsterService as never,
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

  it('fetches monsters', async () => {
    const monsters = [{ id: 1 }] as Monster[];
    monsterService.getAllMonsters.mockResolvedValue(monsters);
    expect(await controller.getMonsters()).toBe(monsters);
  });

  it('validates monster id and spawn input', async () => {
    await expect(controller.getMonsterById('abc')).rejects.toThrow(
      'id must be a numeric value',
    );
    monsterService.getMonsterById.mockResolvedValue({ id: 2 } as Monster);
    expect(await controller.getMonsterById('2')).toEqual({ id: 2 });

    const spawned = { id: 5, name: 'Goblin' } as Monster;
    monsterService.spawnMonster.mockResolvedValue(spawned);
    await expect(controller.spawnMonster({ type: 'goblin' })).resolves.toEqual(
      expect.objectContaining({
        success: true,
        data: spawned,
        message: expect.stringContaining('Spawned'),
      }),
    );

    monsterService.spawnMonster.mockRejectedValue(new Error('boom'));
    await expect(controller.spawnMonster({ type: 'goblin' })).resolves.toEqual(
      expect.objectContaining({ success: false, message: 'boom' }),
    );
  });
});
