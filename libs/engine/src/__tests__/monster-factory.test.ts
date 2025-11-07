import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { getPrismaClient } from '@mud/database';

import {
  MonsterFactory,
  MONSTER_TEMPLATES,
} from '../factories/monster-factory';
import { EventBus } from '../events/event-bus';

const prisma = getPrismaClient();

describe('MonsterFactory', () => {
  let emitSpy: jest.SpiedFunction<typeof EventBus.emit>;

  beforeEach(async () => {
    await prisma.monster.deleteMany();
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates monsters using templates and emits spawn events', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.4);

    const monster = await MonsterFactory.create({
      x: 1,
      y: 2,
      biomeId: 3,
      template: MONSTER_TEMPLATES[0],
    });

    const stored = await prisma.monster.findUnique({
      where: { id: monster.id },
    });

    expect(stored).toMatchObject({
      name: 'Snail',
      biomeId: 3,
      x: 1,
      y: 2,
      isAlive: true,
    });
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'monster:spawn',
        monster: expect.objectContaining({ id: monster.id }),
      }),
    );
  });

  it('loads and saves monsters via prisma', async () => {
    const created = await prisma.monster.create({
      data: {
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
      },
    });

    const loaded = await MonsterFactory.load(created.id);
    expect(loaded?.id).toBe(created.id);

    const atLocation = await MonsterFactory.loadAtLocation(1, 2);
    expect(atLocation).toHaveLength(1);

    const all = await MonsterFactory.loadAll();
    expect(all).toHaveLength(1);

    const bounds = await MonsterFactory.loadInBounds(0, 2, 0, 3);
    expect(bounds).toHaveLength(1);

    if (!loaded) {
      throw new Error('Expected monster to load');
    }

    loaded.position.x = 5;
    loaded.position.y = 6;
    loaded.combat.hp = 10;
    await MonsterFactory.save(loaded);

    const updated = await prisma.monster.findUnique({
      where: { id: created.id },
    });
    expect(updated).toMatchObject({ x: 5, y: 6, hp: 10 });
  });

  it('deletes monsters and converts models', async () => {
    const first = await prisma.monster.create({
      data: {
        name: 'Goblin',
        type: 'humanoid',
        hp: 20,
        maxHp: 20,
        strength: 8,
        agility: 10,
        health: 9,
        x: 0,
        y: 0,
        biomeId: 1,
        isAlive: true,
        spawnedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });
    await prisma.monster.create({
      data: {
        name: 'Zombie',
        type: 'undead',
        hp: 15,
        maxHp: 15,
        strength: 6,
        agility: 6,
        health: 8,
        x: 0,
        y: 0,
        biomeId: 1,
        isAlive: false,
        spawnedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });

    await MonsterFactory.delete(first.id);
    const remaining = await prisma.monster.findMany();
    expect(remaining).toHaveLength(1);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'monster:death',
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );

    const count = await MonsterFactory.deleteMany({ isAlive: false });
    expect(count).toBe(1);

    const template = MonsterFactory.getRandomTemplate();
    expect(MONSTER_TEMPLATES).toContain(template);

    const record = await prisma.monster.create({
      data: {
        name: 'Spider',
        type: 'beast',
        hp: 30,
        maxHp: 30,
        strength: 10,
        agility: 12,
        health: 11,
        x: 2,
        y: 3,
        biomeId: 2,
        isAlive: true,
        spawnedAt: new Date('2024-01-01T00:00:00Z'),
      },
    });

    const entity = MonsterFactory.fromDatabaseModel(record as any);
    expect(entity.getEntityType()).toBe('monster');
    expect(entity.toJSON()).toMatchObject({ id: record.id, type: 'beast' });
  });
});
