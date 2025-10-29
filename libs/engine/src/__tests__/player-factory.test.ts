import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { getPrismaClient } from '@mud/database';

import { PlayerFactory } from '../factories/player-factory';
import { EventBus } from '../events/event-bus';
import { PlayerEntity } from '../entities/player-entity';

const prisma = getPrismaClient();

const basePlayerData = {
  clientId: 'slack:U123',
  clientType: 'slack',
  slackId: 'U123',
  name: 'Hero',
  x: 1,
  y: 2,
  hp: 30,
  maxHp: 30,
  strength: 12,
  agility: 11,
  health: 10,
  level: 5,
  skillPoints: 3,
  gold: 100,
  xp: 450,
  isAlive: true,
  headItemId: null,
  chestItemId: null,
  legsItemId: null,
  armsItemId: null,
  lastAction: new Date('2024-01-01T00:00:00Z'),
};

describe('PlayerFactory', () => {
  let emitSpy: jest.SpiedFunction<typeof EventBus.emit>;

  beforeEach(async () => {
    await prisma.player.deleteMany();
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates players with randomized stats and emits spawn event', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const entity = await PlayerFactory.create({
      clientId: 'U123',
      clientType: 'slack',
      name: 'Hero',
    });

    const stored = await prisma.player.findFirst({
      where: {
        OR: [{ clientId: 'slack:U123' }],
      },
    });

    expect(entity).toBeInstanceOf(PlayerEntity);
    expect(entity.combat.maxHp).toBe(16);
    expect(entity.equipment).toEqual({
      head: null,
      chest: null,
      legs: null,
      arms: null,
      weapon: null,
    });
    expect(stored).toMatchObject({
      clientId: 'slack:U123',
      hp: 16,
      maxHp: 16,
      strength: 3,
      agility: 3,
      health: 3,
    });
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'player:spawn',
        player: expect.objectContaining({ name: 'Hero' }),
      }),
    );
  });

  it('loads players by client id and handles legacy formats', async () => {
    // Create a player with playerItems relation to represent equipped items.
    const created = await prisma.player.create({
      data: {
        ...basePlayerData,
        playerItems: [
          {
            id: 201,
            playerId: undefined,
            itemId: 42,
            equipped: true,
            slot: 'head',
            item: { id: 42, name: 'Iron Helmet', slot: 'head', type: 'armor' },
          },
          {
            id: 202,
            playerId: undefined,
            itemId: 7,
            equipped: true,
            slot: 'weapon',
            item: {
              id: 7,
              name: 'Short Sword',
              slot: 'weapon',
              type: 'weapon',
            },
          },
        ],
      },
    });

    const loaded = await PlayerFactory.load('U123', 'slack');

    expect(loaded?.id).toBe(created.id);
    expect(loaded?.clientId).toBe('U123');
    expect(loaded?.equipment).toEqual({
      head: 42,
      chest: null,
      legs: null,
      arms: null,
      weapon: 7,
    });
  });

  it('loads by name and enforces uniqueness', async () => {
    await prisma.player.create({ data: basePlayerData });
    const single = await PlayerFactory.loadByName('Hero');
    expect(single?.name).toBe('Hero');

    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U124',
        slackId: 'U124',
        name: 'Hero',
      },
    });

    await expect(PlayerFactory.loadByName('Hero')).rejects.toThrow(
      'Multiple players found with the name "Hero".',
    );
  });

  it('loads collections of players', async () => {
    await prisma.player.create({ data: basePlayerData });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U125',
        slackId: 'U125',
        name: 'Ranger',
        x: 0,
        y: 0,
      },
    });

    const all = await PlayerFactory.loadAll();
    expect(all.map((p) => p.name)).toEqual(['Hero', 'Ranger']);

    const atLocation = await PlayerFactory.loadAtLocation(0, 0, {
      aliveOnly: true,
    });
    expect(atLocation).toHaveLength(1);

    const nearby = await PlayerFactory.loadNearby(0, 0, {
      radius: 10,
      limit: 5,
      aliveOnly: false,
    });
    expect(nearby[0].player.name).toBe('Ranger');
    expect(nearby[0].direction).toBe('here');
  });

  it('computes direction labels for nearby players using defaults', async () => {
    await prisma.player.create({
      data: { ...basePlayerData, x: 0, y: 0 },
    });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U124',
        slackId: 'U124',
        id: 2,
        x: 0,
        y: 4,
      },
    });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U125',
        slackId: 'U125',
        id: 3,
        x: 4,
        y: 0,
      },
    });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U126',
        slackId: 'U126',
        id: 4,
        x: -4,
        y: 0,
      },
    });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U127',
        slackId: 'U127',
        id: 5,
        x: 0,
        y: -3,
      },
    });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U128',
        slackId: 'U128',
        id: 6,
        x: -2,
        y: -2,
      },
    });

    const nearby = await PlayerFactory.loadNearby(0, 0);

    const directionByClientId = Object.fromEntries(
      nearby.map((entry) => [entry.player.clientId, entry.direction]),
    );

    expect(directionByClientId['U123']).toBe('here');
    expect(directionByClientId['U124']).toBe('north');
    expect(directionByClientId['U125']).toBe('east');
    expect(directionByClientId['U126']).toBe('west');
    expect(directionByClientId['U127']).toBe('south');
    expect(directionByClientId['U128']).toBe('southwest');
  });

  it('deletes, updates, and saves players', async () => {
    const created = await prisma.player.create({ data: basePlayerData });
    const entity = PlayerFactory.fromDatabaseModel(created, 'slack');

    entity.position.x = 5;
    entity.position.y = 6;
    entity.combat.hp = 10;
    entity.gold = 250;
    // use canonical weapon slot
    entity.equipment.weapon = 99;
    entity.equipment.arms = 33;

    await PlayerFactory.save(entity);

    const updated = await prisma.player.findFirst({
      where: { OR: [{ clientId: created.clientId }] },
    });

    expect(updated).toMatchObject({
      x: 5,
      y: 6,
      hp: 10,
      gold: 250,
    });

    const previousLastAction = created.lastAction!;
    await PlayerFactory.updateLastAction('U123', 'slack');
    const refreshed = await prisma.player.findFirst({
      where: { OR: [{ clientId: 'slack:U123' }] },
    });
    expect(refreshed?.lastAction?.getTime()).toBeGreaterThan(
      previousLastAction.getTime(),
    );

    await PlayerFactory.delete(created.id);
    const remaining = await prisma.player.count();
    expect(remaining).toBe(0);
  });

  it('counts active players within threshold', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T12:00:00Z'));

    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U200',
        slackId: 'U200',
        lastAction: new Date('2024-01-01T11:55:00Z'),
      },
    });
    await prisma.player.create({
      data: {
        ...basePlayerData,
        clientId: 'slack:U201',
        slackId: 'U201',
        lastAction: new Date('2024-01-01T11:20:00Z'),
      },
    });

    const count = await PlayerFactory.countActivePlayers(15);
    expect(count).toBe(1);

    jest.useRealTimers();
  });

  it('maps equipment using item.slot when playerItem.slot is missing', () => {
    // Build a fake database player object with playerItems including an item that
    // declares its slot. The playerItem.slot is intentionally omitted/null.
    const playerFromDb: Record<string, unknown> = {
      id: 999,
      clientId: 'slack:U999',
      clientType: 'slack',
      slackId: 'U999',
      name: 'Mapper',
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      strength: 5,
      agility: 5,
      health: 5,
      level: 1,
      skillPoints: 0,
      gold: 0,
      xp: 0,
      isAlive: true,
      playerItems: [
        {
          id: 123,
          playerId: 999,
          itemId: 42,
          equipped: true,
          // slot missing here on purpose
          slot: null,
          item: {
            id: 42,
            name: 'Iron Helmet',
            slot: 'head',
            type: 'armor',
          },
        },
      ],
    };

    const entity = PlayerFactory.fromDatabaseModel(playerFromDb, 'slack');
    expect(entity.equipment.head).toBe(42);
  });
});
