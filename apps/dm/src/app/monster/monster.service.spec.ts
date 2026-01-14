import { MonsterService } from './monster.service';
import { EventBus } from '../../shared/event-bus';

const monsters: Record<string, unknown>[] = [];

const mockPrisma = {
  monster: {
    create: jest.fn(async ({ data }) => {
      const monster = {
        id: monsters.length + 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        spawnedAt: new Date(),
        ...data,
      };
      monsters.push(monster);
      return monster;
    }),
    findMany: jest.fn(async () => monsters),
    findUnique: jest.fn(async ({ where: { id } }) =>
      monsters.find((m) => m.id === id) ?? null,
    ),
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
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    monsters.length = 0;
    jest.spyOn(global.Math, 'random').mockImplementation(() => 0.2);
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('spawns a monster and emits a spawn event', async () => {
    const service = new MonsterService();
    const spawned = await service.spawnMonster();

    expect(spawned).toMatchObject({
      id: 1,
      name: expect.any(String),
      hp: expect.any(Number),
      isAlive: true,
    });
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'monster:spawn' }),
    );
  });

  it('lists monsters and fetches by id', async () => {
    const service = new MonsterService();
    const spawned = await service.spawnMonster();

    const all = await service.getAllMonsters();
    expect(all).toHaveLength(1);

    const found = await service.getMonsterById(spawned.id);
    expect(found?.id).toBe(spawned.id);
  });
});
