import { BadRequestException, ConflictException } from '@nestjs/common';
import { PlayerService } from './player.service';
import { EventBus } from '../../shared/event-bus';

type StoredPlayer = {
  id: number;
  name: string;
  teamId: string;
  userId: string;
  slackUser: { teamId: string; userId: string };
  hp: number;
  maxHp: number;
  strength: number;
  agility: number;
  health: number;
  level: number;
  xp: number;
  gold: number;
  x: number;
  y: number;
  isAlive: boolean;
  lastAction: Date;
};

type StoredSlackUser = {
  teamId: string;
  userId: string;
  playerId: number;
};

const players: StoredPlayer[] = [];
const slackUsers: StoredSlackUser[] = [];

const mockPrisma = {
  player: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
  },
  slackUser: {
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockFindPlayerBySlackUser = jest.fn();

jest.mock('@mud/database', () => ({
  getPrismaClient: () => mockPrisma,
  findPlayerBySlackUser: (...args: unknown[]) =>
    mockFindPlayerBySlackUser(...(args as [unknown])),
  Player: class {},
  Prisma: {} as never,
}));

const seedPlayer = (
  overrides: Partial<StoredPlayer> = {},
  withSlack = true,
) => {
  const id = overrides.id ?? players.length + 1;
  const teamId = overrides.teamId ?? `T${id}`;
  const userId = overrides.userId ?? `U${id}`;
  const player: StoredPlayer = {
    id,
    name: overrides.name ?? `Player-${id}`,
    teamId,
    userId,
    slackUser:
      overrides.slackUser ??
      (withSlack ? { teamId, userId } : { teamId: '', userId: '' }),
    hp: overrides.hp ?? 10,
    maxHp: overrides.maxHp ?? 10,
    strength: overrides.strength ?? 10,
    agility: overrides.agility ?? 10,
    health: overrides.health ?? 10,
    level: overrides.level ?? 1,
    xp: overrides.xp ?? 0,
    gold: overrides.gold ?? 0,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    isAlive: overrides.isAlive ?? true,
    lastAction: overrides.lastAction ?? new Date(Date.now() - 60_000),
  };
  players.push(player);
  if (withSlack) {
    slackUsers.push({
      teamId: player.slackUser.teamId,
      userId: player.slackUser.userId,
      playerId: player.id,
    });
  }
  return player;
};

const resetInMemoryDb = () => {
  players.length = 0;
  slackUsers.length = 0;
};

const clonePlayer = (player: StoredPlayer) => ({
  ...player,
  slackUser: { ...player.slackUser },
});

const buildWorldService = () => ({
  getTileInfo: jest.fn().mockResolvedValue({ biomeName: 'forest' }),
});

describe('PlayerService (refactored flows)', () => {
  let service: PlayerService;
  let worldService: ReturnType<typeof buildWorldService>;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    resetInMemoryDb();
    jest.resetAllMocks();
    worldService = buildWorldService();

    mockPrisma.player.create.mockImplementation(async ({ data }) => {
      const player: StoredPlayer = {
        id: players.length + 1,
        name: data.name ?? `Player-${players.length + 1}`,
        teamId: '',
        userId: '',
        slackUser: { teamId: '', userId: '' },
        hp: data.hp,
        maxHp: data.maxHp,
        strength: data.strength ?? 10,
        agility: data.agility ?? 10,
        health: data.health ?? 10,
        level: data.level ?? 1,
        xp: data.xp ?? 0,
        gold: data.gold ?? 0,
        x: data.x ?? 0,
        y: data.y ?? 0,
        isAlive: data.isAlive ?? true,
        lastAction: data.lastAction ?? new Date(),
      };
      players.push(player);
      return clonePlayer(player);
    });

    mockPrisma.player.update.mockImplementation(async ({ where, data }) => {
      const player = players.find((p) => p.id === where.id);
      if (!player) throw new Error('player not found');
      Object.assign(player, data);
      return clonePlayer(player);
    });

    mockPrisma.player.findMany.mockImplementation(async ({ where } = {}) => {
      if (!where) return players.map(clonePlayer);
      let result = [...players];
      if (where.isAlive !== undefined) {
        result = result.filter((p) => p.isAlive === where.isAlive);
      }
      if (where.slackUser?.teamId) {
        result = result.filter(
          (p) => p.slackUser.teamId === where.slackUser.teamId,
        );
      }
      return result.map(clonePlayer);
    });

    mockPrisma.player.findUnique.mockImplementation(async ({ where }) => {
      if (where.id !== undefined) {
        const player = players.find((p) => p.id === where.id);
        return player ? clonePlayer(player) : null;
      }
      return null;
    });

    mockPrisma.player.count.mockImplementation(async ({ where }) => {
      if (!where?.lastAction?.gte) return players.length;
      const cutoff = where.lastAction.gte as Date;
      return players.filter((p) => p.lastAction >= cutoff).length;
    });

    mockPrisma.slackUser.create.mockImplementation(async ({ data }) => {
      slackUsers.push({
        teamId: data.teamId,
        userId: data.userId,
        playerId: data.playerId,
      });
      const player = players.find((p) => p.id === data.playerId);
      if (player) {
        player.teamId = data.teamId;
        player.userId = data.userId;
        player.slackUser = { teamId: data.teamId, userId: data.userId };
      }
      return { ...data, id: data.playerId };
    });

    mockPrisma.slackUser.delete.mockImplementation(async ({ where }) => {
      const index = slackUsers.findIndex(
          (entry) =>
            entry.teamId === where.teamId_userId.teamId &&
            entry.userId === where.teamId_userId.userId,
        );
      if (index >= 0) {
        slackUsers.splice(index, 1);
      }
      return null;
    });

    mockFindPlayerBySlackUser.mockImplementation(
      async ({ teamId, userId }: { teamId: string; userId: string }) => {
        const record = players.find(
          (p) =>
            p.slackUser.teamId === teamId && p.slackUser.userId === userId,
        );
        return record ? clonePlayer(record) : undefined;
      },
    );

    service = new PlayerService(worldService as never);
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue(undefined);
  });

  afterEach(() => {
    emitSpy?.mockRestore();
  });

  it('creates a player with workspace identity and prevents duplicates', async () => {
    (service as any).generateRandomStats = jest.fn().mockReturnValue({
      strength: 12,
      agility: 11,
      health: 13,
      maxHp: 12,
    });
    (service as any).findValidSpawnPosition = jest
      .fn()
      .mockResolvedValue({ x: 5, y: -5 });

    const created = await service.createPlayer({
      name: 'Hero',
      teamId: 'T1',
      userId: 'U1',
      x: 0,
      y: 0,
    });

    expect(created.name).toBe('Hero');
    expect(created.x).toBe(5);
    expect(mockPrisma.player.create).toHaveBeenCalledTimes(1);
    await expect(service.getPlayer('T1', 'U1')).resolves.toEqual(
      expect.objectContaining({ name: 'Hero' }),
    );
    expect(mockPrisma.slackUser.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: 'T1', userId: 'U1' }),
      }),
    );

    await expect(
      service.createPlayer({
        name: 'Duplicate',
        teamId: 'T1',
        userId: 'U1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when missing teamId or userId inputs', async () => {
    await expect(
      service.createPlayer({
        name: 'Hero',
        teamId: undefined as unknown as string,
        userId: 'U1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('retrieves players through findPlayerBySlackUser', async () => {
    const stored = seedPlayer({ teamId: 'T42', userId: 'UserA', name: 'Alice' });

    const player = await service.getPlayer('T42', 'UserA');
    expect(player.name).toBe(stored.name);

    await expect(service.getPlayer('unknown', 'missing')).rejects.toThrow(
      /Player not found/,
    );
  });

  it('moves players while respecting agility-based distance limits', async () => {
    const stored = seedPlayer({
      teamId: 'T1',
      userId: 'Mover',
      agility: 6,
      x: 0,
      y: 0,
    });
    const startX = stored.x;

    const moved = await service.movePlayer(
      'T1',
      'Mover',
      { direction: 'east', distance: 4 } as any,
    );

    expect(moved.x).toBe(startX + 4);
    expect(mockPrisma.player.update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({ x: startX + 4 }),
    });

    await expect(
      service.movePlayer('T1', 'Mover', {
        direction: 'south',
        distance: 99,
      } as any),
    ).rejects.toThrow('You can move up to');
  });

  it('updates combat stats and awards XP on level up', async () => {
    const stored = seedPlayer({
      teamId: 'T2',
      userId: 'Leveler',
      xp: 50,
      gold: 1,
    });
    mockPrisma.player.update.mockImplementation(async ({ where, data }) => {
      const player = players.find((p) => p.id === where.id)!;
      Object.assign(player, data);
      return clonePlayer(player);
    });

    const updated = await service.updatePlayerStats('T2', 'Leveler', {
      xp: 200,
      gold: 6,
    } as any);

    expect(updated.xp).toBe(200);
    expect(updated.gold).toBe(6);
    expect(mockPrisma.player.update).toHaveBeenCalled();
  });

  it('reports active players based on lastAction threshold', async () => {
    seedPlayer({
      teamId: 'T3',
      userId: 'Active',
      lastAction: new Date(),
    });
    mockPrisma.player.count.mockResolvedValueOnce(1);
    await expect(service.hasActivePlayers(30)).resolves.toBe(true);

    mockPrisma.player.count.mockResolvedValueOnce(0);
    await expect(service.hasActivePlayers(30)).resolves.toBe(false);
  });

  it('updates lastAction timestamp', async () => {
    const stored = seedPlayer({ teamId: 'T4', userId: 'Timer' });
    await service.updateLastAction(stored.id);
    expect(mockPrisma.player.update).toHaveBeenCalledWith({
      where: { id: stored.id },
      data: expect.objectContaining({ lastAction: expect.any(Date) }),
    });
  });

  it('calculates Euclidean distance between two coordinates', () => {
    expect(service.calculateDistance(0, 0, 3, 4)).toBe(5);
  });
});
