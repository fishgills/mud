import { MonsterService } from './monster.service';
import { EventBus } from '../../shared/event-bus';

const monsters: Record<string, unknown>[] = [];

const mockPrisma = {
  monster: {
    create: jest.fn(async ({ data }) => {
      const monster = {
        id: monsters.length + 1,
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        ...data,
      };
      monsters.push(monster);
      return monster;
    }),
    findMany: jest.fn(async (args: Record<string, unknown> = {}) => {
      let result = monsters.filter((m) => m.isAlive !== false);
      const where = args.where ?? {};
      if (where.x?.gte !== undefined) {
        result = result.filter(
          (m) =>
            m.x >= where.x.gte &&
            m.x <= where.x.lte &&
            m.y >= where.y.gte &&
            m.y <= where.y.lte,
        );
      } else {
        if (where.x !== undefined) {
          result = result.filter((m) => m.x === where.x);
        }
        if (where.y !== undefined) {
          result = result.filter((m) => m.y === where.y);
        }
      }
      if (where.isAlive !== undefined) {
        result = monsters.filter((m) => m.isAlive === where.isAlive);
      }
      if (args.include?.biome) {
        return result.map((m) => ({ ...m, biome: { name: 'forest' } }));
      }
      return result;
    }),
    findUnique: jest.fn(
      async ({ where: { id } }) =>
        monsters.find((m) => m.id === id && m.isAlive !== false) ?? null,
    ),
    update: jest.fn(async ({ where: { id }, data }) => {
      const idx = monsters.findIndex((m) => m.id === id);
      if (idx === -1) throw new Error('not found');
      monsters[idx] = { ...monsters[idx], ...data };
      return monsters[idx];
    }),
    deleteMany: jest.fn(async ({ where: { updatedAt } }) => {
      const before = monsters.length;
      for (let i = monsters.length - 1; i >= 0; i--) {
        if (
          monsters[i].isAlive === false &&
          monsters[i].updatedAt < updatedAt.lt
        ) {
          monsters.splice(i, 1);
        }
      }
      return { count: before - monsters.length };
    }),
  },
};

jest.mock('@mud/database', () => {
  const actual =
    jest.requireActual<typeof import('@mud/database')>('@mud/database');
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
  };
});

describe('MonsterService', () => {
  const worldService = {
    getTileInfo: jest.fn().mockImplementation(async (x: number, y: number) => ({
      x,
      y,
      biomeName: x === 999 ? 'ocean' : 'forest',
      biomeId: 2,
    })),
    getTileInfoWithNearby: jest.fn().mockResolvedValue({
      tile: { x: 0, y: 0, biomeName: 'forest', biomeId: 2 },
      nearbyBiomes: [],
    }),
  } as unknown as Parameters<typeof MonsterService.prototype.constructor>[0];
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    monsters.length = 0;
    jest.spyOn(global.Math, 'random').mockImplementation(() => 0.2);
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('spawns monsters and prevents water spawns', async () => {
    const service = new MonsterService(worldService);
    const spawned = await service.spawnMonster(1, 2, 1);
    expect(spawned.hp).toBeGreaterThan(0);

    await expect(service.spawnMonster(999, 2, 1)).rejects.toThrow('water');
  });

  it('lists monsters and moves them', async () => {
    const service = new MonsterService(worldService);
    monsters.push({
      id: 1,
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      strength: 5,
      agility: 5,
      health: 5,
      biomeId: 1,
      isAlive: true,
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    emitSpy.mockClear();
    await service.moveMonster(1);
    expect(monsters[0].lastMove).toBeDefined();
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'monster:move' }),
    );

    worldService.getTileInfo.mockResolvedValueOnce({
      x: 1,
      y: 1,
      biomeName: 'ocean',
    });
    await service.moveMonster(1);

    const all = await service.getAllMonsters();
    expect(all.length).toBeGreaterThan(0);

    await service.getMonstersAtLocation(monsters[0].x, monsters[0].y);
    await service.getMonstersInBounds(-5, 5, -5, 5);
  });

  it('damages and cleans up monsters', async () => {
    const service = new MonsterService(worldService);
    monsters.push({
      id: 2,
      x: 0,
      y: 0,
      hp: 5,
      maxHp: 5,
      strength: 5,
      agility: 5,
      health: 5,
      biomeId: 1,
      isAlive: true,
      updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    });

    emitSpy.mockClear();
    const damaged = await service.damageMonster(2, 10);
    expect(damaged.isAlive).toBe(false);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'monster:death',
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );

    await service.cleanupDeadMonsters();
    expect(monsters.find((m) => m.id === 2)).toBeUndefined();
  });

  it('spawns monsters in an area with constraints', async () => {
    const service = new MonsterService(worldService);
    const result = await service.spawnMonstersInArea(0, 0, 2, {
      maxGroupSize: 2,
    });

    expect(result.length).toBeGreaterThan(0);
  });
});
