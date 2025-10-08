import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import {
  MonsterFactory,
  MONSTER_TEMPLATES,
} from '../factories/monster-factory';
import { EventBus } from '../events/event-bus';

const createMockMonster = (overrides: Partial<any> = {}) => ({
  id: 1,
  name: 'Goblin',
  type: 'humanoid',
  hp: 20,
  maxHp: 20,
  strength: 8,
  agility: 10,
  health: 9,
  x: 1,
  y: 2,
  biomeId: 3,
  isAlive: true,
  spawnedAt: new Date('2024-01-01T00:00:00Z'),
  lastMove: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('MonsterFactory', () => {
  let emitSpy: jest.SpiedFunction<typeof EventBus.emit>;
  let mockPrisma: any;

  beforeEach(() => {
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();
    mockPrisma = {
      monster: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    (MonsterFactory as unknown as { prisma: any }).prisma = mockPrisma;
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates monsters using templates and emits spawn events', async () => {
    const monsterRecord = createMockMonster();
    mockPrisma.monster.create.mockResolvedValue(monsterRecord);

    const monster = await MonsterFactory.create({
      x: 1,
      y: 2,
      biomeId: 3,
      template: MONSTER_TEMPLATES[0],
    });

    expect(mockPrisma.monster.create).toHaveBeenCalled();
    expect(monster.name).toBe(monsterRecord.name);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'monster:spawn',
        monster: monsterRecord,
      }),
    );
  });

  it('loads and saves monsters via prisma', async () => {
    const monsterRecord = createMockMonster();
    mockPrisma.monster.findUnique.mockResolvedValue(monsterRecord);
    mockPrisma.monster.findMany.mockResolvedValue([monsterRecord]);

    const loaded = await MonsterFactory.load(1);
    expect(loaded?.id).toBe(1);

    const atLocation = await MonsterFactory.loadAtLocation(1, 2);
    expect(atLocation).toHaveLength(1);

    const all = await MonsterFactory.loadAll();
    expect(all).toHaveLength(1);

    const bounds = await MonsterFactory.loadInBounds(0, 2, 0, 3);
    expect(bounds).toHaveLength(1);

    await MonsterFactory.save(loaded!);
    expect(mockPrisma.monster.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 1 } }),
    );
  });

  it('deletes monsters and converts models', async () => {
    mockPrisma.monster.deleteMany.mockResolvedValue({ count: 2 });

    await MonsterFactory.delete(1);
    expect(mockPrisma.monster.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });

    const count = await MonsterFactory.deleteMany({ isAlive: false });
    expect(count).toBe(2);

    const template = MonsterFactory.getRandomTemplate();
    expect(MONSTER_TEMPLATES).toContain(template);

    const record = createMockMonster();
    const entity = MonsterFactory.fromDatabaseModel(record as any);
    expect(entity.getEntityType()).toBe('monster');
    expect(entity.toJSON()).toMatchObject({ id: 1, type: 'humanoid' });
  });
});
