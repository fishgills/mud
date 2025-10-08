import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { PlayerFactory } from '../factories/player-factory';
import { EventBus } from '../events/event-bus';
import { PlayerEntity } from '../entities/player-entity';

const basePlayerRecord = {
  id: 1,
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
  lastAction: new Date('2024-01-01T00:00:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
};

describe('PlayerFactory', () => {
  let emitSpy: jest.SpiedFunction<typeof EventBus.emit>;
  let mockPrisma: any;

  beforeEach(() => {
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue();
    mockPrisma = {
      player: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
    };
    (PlayerFactory as unknown as { prisma: any }).prisma = mockPrisma;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates players with randomized stats and emits spawn event', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    mockPrisma.player.create.mockResolvedValue({
      ...basePlayerRecord,
      hp: 16,
      maxHp: 16,
      strength: 3,
      agility: 3,
      health: 3,
      level: 1,
      skillPoints: 0,
      gold: 0,
      xp: 0,
      x: 0,
      y: 0,
    });

    const entity = await PlayerFactory.create({
      clientId: 'U123',
      clientType: 'slack',
      name: 'Hero',
    });

    expect(mockPrisma.player.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: 'slack:U123' }),
      }),
    );
    expect(entity).toBeInstanceOf(PlayerEntity);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'player:spawn',
        player: expect.any(Object),
      }),
    );
  });

  it('loads players by client id and handles legacy formats', async () => {
    mockPrisma.player.findFirst.mockResolvedValue(basePlayerRecord);

    const loaded = await PlayerFactory.load('U123', 'slack');
    expect(mockPrisma.player.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { clientId: 'slack:U123' },
            { clientId: 'U123' },
            { slackId: 'U123' },
          ],
        },
      }),
    );
    expect(loaded?.clientId).toBe('U123');
  });

  it('loads by name and enforces uniqueness', async () => {
    mockPrisma.player.findMany
      .mockResolvedValueOnce([basePlayerRecord])
      .mockResolvedValueOnce([
        basePlayerRecord,
        { ...basePlayerRecord, id: 2 },
      ]);

    const loaded = await PlayerFactory.loadByName('Hero');
    expect(loaded?.id).toBe(1);

    await expect(PlayerFactory.loadByName('Hero')).rejects.toThrow(
      'Multiple players found with the name "Hero"',
    );
  });

  it('loads collections of players', async () => {
    mockPrisma.player.findMany
      .mockResolvedValueOnce([basePlayerRecord])
      .mockResolvedValueOnce([basePlayerRecord])
      .mockResolvedValueOnce([
        basePlayerRecord,
        { ...basePlayerRecord, id: 2, x: 5, y: 5 },
      ]);

    const all = await PlayerFactory.loadAll();
    expect(all).toHaveLength(1);

    const atLocation = await PlayerFactory.loadAtLocation(1, 2, {
      excludePlayerId: 99,
      aliveOnly: true,
    });
    expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 99 },
          isAlive: true,
          x: 1,
          y: 2,
        }),
      }),
    );
    expect(atLocation).toHaveLength(1);

    const nearby = await PlayerFactory.loadNearby(0, 0, {
      radius: 10,
      limit: 5,
      excludeSlackId: 'U123',
      aliveOnly: false,
    });
    expect(nearby[0].distance).toBeCloseTo(Math.sqrt(1 * 1 + 2 * 2));
    expect(nearby[0].direction).toBe('northeast');
  });

  it('computes direction labels for nearby players using defaults', async () => {
    const players = [
      { ...basePlayerRecord, x: 0, y: 0 },
      { ...basePlayerRecord, id: 2, clientId: 'slack:U124', x: 0, y: 4 },
      { ...basePlayerRecord, id: 3, clientId: 'slack:U125', x: 4, y: 0 },
      { ...basePlayerRecord, id: 4, clientId: 'slack:U126', x: -4, y: 0 },
      { ...basePlayerRecord, id: 5, clientId: 'slack:U127', x: 0, y: -3 },
      { ...basePlayerRecord, id: 6, clientId: 'slack:U128', x: -2, y: -2 },
    ];

    mockPrisma.player.findMany.mockResolvedValue(players);

    const nearby = await PlayerFactory.loadNearby(0, 0);

    expect(mockPrisma.player.findMany).toHaveBeenCalledWith({
      where: { isAlive: true },
    });

    expect(nearby).toHaveLength(players.length);

    const directionById = Object.fromEntries(
      nearby.map((entry) => [entry.player.id, entry.direction]),
    );

    expect(directionById[1]).toBe('here');
    expect(directionById[2]).toBe('north');
    expect(directionById[3]).toBe('east');
    expect(directionById[4]).toBe('west');
    expect(directionById[5]).toBe('south');
    expect(directionById[6]).toBe('southwest');

    expect(nearby.map((entry) => entry.distance)).toEqual(
      expect.arrayContaining([
        0,
        Math.sqrt(4 ** 2 + 0 ** 2),
        Math.sqrt((-4) ** 2 + 0 ** 2),
        Math.sqrt(0 ** 2 + 4 ** 2),
        Math.sqrt(0 ** 2 + (-3) ** 2),
        Math.sqrt((-2) ** 2 + (-2) ** 2),
      ]),
    );
  });

  it('deletes, updates, and saves players', async () => {
    await PlayerFactory.delete(1);
    expect(mockPrisma.player.delete).toHaveBeenCalledWith({ where: { id: 1 } });

    await PlayerFactory.updateLastAction('U123', 'slack');
    expect(mockPrisma.player.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { clientId: 'slack:U123' },
            { clientId: 'U123' },
            { slackId: 'U123' },
          ],
        },
      }),
    );

    const entity = PlayerFactory.fromDatabaseModel(
      basePlayerRecord as any,
      'slack',
    );
    await PlayerFactory.save(entity);
    expect(mockPrisma.player.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: basePlayerRecord.id } }),
    );
  });

  it('counts active players within threshold', async () => {
    mockPrisma.player.count.mockResolvedValue(3);

    const count = await PlayerFactory.countActivePlayers(15);
    expect(mockPrisma.player.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lastAction: expect.any(Object) } }),
    );
    expect(count).toBe(3);
  });
});
