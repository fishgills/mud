import { PlayerService } from './player.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  CreatePlayerRequest,
  MovePlayerRequest,
  PlayerStatsRequest,
} from '../api/dto/player-requests.dto';

const players: Record<string, unknown>[] = [];

jest.mock('@mud/database', () => ({
  getPrismaClient: () => ({
    player: {
      findUnique: jest.fn(async ({ where }) => {
        if (where?.id) {
          return players.find((p) => p.id === where.id) ?? null;
        }
        if (where?.slackId) {
          return players.find((p) => p.slackId === where.slackId) ?? null;
        }
        if (where?.clientId) {
          return players.find((p) => p.clientId === where.clientId) ?? null;
        }
        return null;
      }),
      findFirst: jest.fn(async ({ where }) => {
        if (where.OR) {
          for (const condition of where.OR) {
            if (condition.clientId) {
              const player = players.find(
                (p) => p.clientId === condition.clientId,
              );
              if (player) return player;
            }
            if (condition.slackId) {
              const player = players.find(
                (p) => p.slackId === condition.slackId,
              );
              if (player) return player;
            }
          }
          return null;
        }
        // Handle simple where clause
        if (where.clientId) {
          return players.find((p) => p.clientId === where.clientId) ?? null;
        }
        if (where.slackId) {
          return players.find((p) => p.slackId === where.slackId) ?? null;
        }
        return null;
      }),
      findMany: jest.fn(async (args: Record<string, unknown> = {}) => {
        let result = [...players];
        const where = args.where ?? {};
        if (where.isAlive !== undefined) {
          result = result.filter((p) => p.isAlive === where.isAlive);
        }
        if (where.slackId?.not) {
          result = result.filter((p) => p.slackId !== where.slackId.not);
        }
        if (where.x && where.x.gte !== undefined) {
          result = result.filter(
            (p) => p.x >= where.x.gte && p.x <= where.x.lte,
          );
        }
        if (where.y && where.y.gte !== undefined) {
          result = result.filter(
            (p) => p.y >= where.y.gte && p.y <= where.y.lte,
          );
        }
        if (where.name?.equals) {
          const equals = where.name.equals.toLowerCase();
          result = result.filter((p) => p.name.toLowerCase() === equals);
        }
        if (
          where.x === undefined &&
          where.y === undefined &&
          where.name === undefined &&
          where.isAlive === undefined &&
          where.slackId === undefined &&
          args.where?.id
        ) {
          result = result.filter((p) => p.id === args.where.id);
        }
        if (args.select) {
          return result.map((player) => {
            const selected: Record<string, unknown> = {};
            for (const key of Object.keys(args.select)) {
              if (args.select[key]) {
                selected[key] = player[key];
              }
            }
            return selected;
          });
        }
        return result;
      }),
      count: jest.fn(async (args: Record<string, unknown> = {}) => {
        let result = [...players];
        const where = args.where ?? {};
        if (where.lastAction?.gte) {
          result = result.filter(
            (p) => p.lastAction && p.lastAction >= where.lastAction.gte,
          );
        }
        return result.length;
      }),
      create: jest.fn(async ({ data }) => {
        const player = {
          id: players.length + 1,
          createdAt: new Date(),
          updatedAt: new Date(),
          xp: 0,
          gold: 0,
          lastAction: new Date(),
          skillPoints: 0,
          ...data,
        };
        players.push(player);
        return player;
      }),
      update: jest.fn(async ({ where, data }) => {
        const idx = players.findIndex((p) =>
          where.id !== undefined
            ? p.id === where.id
            : where.slackId
              ? p.slackId === where.slackId
              : where.clientId
                ? p.clientId === where.clientId
                : false,
        );
        if (idx === -1) throw new Error('not found');
        players[idx] = { ...players[idx], ...data };
        return players[idx];
      }),
      updateMany: jest.fn(async ({ where, data }) => {
        let count = 0;
        for (const player of players) {
          const matches =
            where?.OR?.some((condition: Record<string, unknown>) => {
              if (condition.clientId) {
                return player.clientId === condition.clientId;
              }
              if (condition.slackId) {
                return player.slackId === condition.slackId;
              }
              return false;
            }) ?? false;
          if (matches) {
            Object.assign(player, data);
            count += 1;
          }
        }
        return { count };
      }),
      delete: jest.fn(async ({ where }) => {
        const idx = players.findIndex((p) =>
          where.id !== undefined
            ? p.id === where.id
            : where.slackId
              ? p.slackId === where.slackId
              : false,
        );
        if (idx === -1) throw new Error('not found');
        const [removed] = players.splice(idx, 1);
        return removed;
      }),
    },
  }),
}));

describe('PlayerService', () => {
  const worldService = {
    getTileInfo: jest.fn().mockImplementation(async (x: number, y: number) => ({
      x,
      y,
      biomeName: y >= 101 ? 'ocean' : 'forest',
      biomeId: 1,
    })),
  } as unknown as Parameters<typeof PlayerService.prototype.constructor>[0];

  beforeEach(() => {
    players.length = 0;
    players.push({
      id: 99,
      slackId: 'EXIST',
      clientId: 'slack:EXIST',
      clientType: 'slack',
      name: 'Existing',
      x: 100,
      y: 100,
      hp: 10,
      maxHp: 10,
      strength: 10,
      agility: 10,
      health: 10,
      level: 1,
      skillPoints: 0,
      isAlive: true,
    });
    jest.spyOn(global.Math, 'random').mockImplementation(() => 0.25);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a player and prevents duplicates', async () => {
    const service = new PlayerService(worldService);
    const created = await service.createPlayer({
      slackId: 'U1',
      name: 'Hero',
      x: 0,
      y: 0,
    } as CreatePlayerRequest);
    expect(created.clientType).toBe('slack');
    expect(created.clientId).toBe('U1');

    await expect(
      service.createPlayer({
        slackId: 'U1',
        name: 'Hero',
        x: 0,
        y: 0,
      } as CreatePlayerRequest),
    ).rejects.toThrow(ConflictException);
  });

  it('gets players by slack and name with error handling', async () => {
    const service = new PlayerService(worldService);
    const player = await service.getPlayer('EXIST');
    expect(player.name).toBe('Existing');

    await expect(service.getPlayer('UNKNOWN')).rejects.toThrow();

    await expect(service.getPlayerByName(' ')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.getPlayerByName('missing')).rejects.toThrow();

    players.push({ ...players[0], id: 100, slackId: 'EX2', name: 'Existing' });
    await expect(service.getPlayerByName('Existing')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('moves players and validates movement', async () => {
    const service = new PlayerService(worldService);
    const moved = await service.movePlayer('EXIST', {
      direction: 'east',
      distance: 3,
    } as MovePlayerRequest);
    expect(moved.position.x).toBe(103);

    await expect(
      service.movePlayer('EXIST', { x: 1 } as MovePlayerRequest),
    ).rejects.toThrow('Both x and y');

    await expect(
      service.movePlayer('EXIST', {
        direction: 'invalid',
      } as MovePlayerRequest),
    ).rejects.toThrow('Invalid direction');

    await expect(
      service.movePlayer('EXIST', {
        direction: 'south',
        distance: 0,
      } as MovePlayerRequest),
    ).rejects.toThrow('Distance must be a positive whole number.');

    await expect(
      service.movePlayer('EXIST', {
        direction: 'east',
        distance: 99,
      } as MovePlayerRequest),
    ).rejects.toThrow('You can move up to 10 spaces based on your agility.');

    await expect(
      service.movePlayer('EXIST', { direction: 'north' } as MovePlayerRequest),
    ).rejects.toThrow('water');
  });

  it('updates stats, rerolls, heals and damages', async () => {
    const service = new PlayerService(worldService);
    const updated = await service.updatePlayerStats('EXIST', {
      hp: 5,
      xp: 10,
      gold: 3,
      level: 2,
    } as PlayerStatsRequest);
    expect(updated.combat.hp).toBe(5);

    players[0].hp = 1;
    const rerolled = await service.rerollPlayerStats('EXIST');
    expect(rerolled.combat.maxHp).toBeGreaterThan(0);

    const healed = await service.healPlayer('EXIST', 5);
    expect(healed.combat.hp).toBeLessThanOrEqual(healed.combat.maxHp);

    const damaged = await service.damagePlayer('EXIST', 200);
    expect(damaged.combat.isAlive).toBe(false);
  });

  it('levels up and awards skill points based on XP thresholds', async () => {
    const service = new PlayerService(worldService);
    const leveled = await service.updatePlayerStats('EXIST', {
      // Triangular thresholds (base=100): 100, 300, 600, 1000 => level 5 at 1000
      xp: 1000,
    } as PlayerStatsRequest);

    expect(leveled.level).toBe(5);
    // expect(leveled.combat.maxHp).toBe(34);
    // expect(leveled.combat.hp).toBe(34);
    expect(leveled.skillPoints).toBe(2);
  });

  it('spends skill points to increase attributes', async () => {
    const service = new PlayerService(worldService);
    players[0].skillPoints = 2;

    const afterStrength = await service.spendSkillPoint('EXIST', 'strength');
    expect(afterStrength.skillPoints).toBe(1);
    expect(afterStrength.attributes.strength).toBe(11);

    const maxHpBeforeHealth = players[0].maxHp;
    const afterHealth = await service.spendSkillPoint('EXIST', 'health');
    expect(afterHealth.skillPoints).toBe(0);
    expect(afterHealth.attributes.health).toBe(11);
    expect(afterHealth.combat.maxHp).toBeGreaterThan(maxHpBeforeHealth);

    await expect(service.spendSkillPoint('EXIST', 'agility')).rejects.toThrow(
      'No skill points available.',
    );
  });

  it('respawns, deletes, and finds players nearby', async () => {
    const service = new PlayerService(worldService);
    const respawned = await service.respawnPlayer('EXIST');
    expect(respawned.combat.isAlive).toBe(true);

    const removed = await service.deletePlayer('EXIST');
    expect(removed.clientId).toBe('EXIST');

    players.push(
      {
        id: 101,
        slackId: 'A',
        clientId: 'slack:A',
        clientType: 'slack',
        name: 'A',
        x: 10,
        y: 10,
        hp: 5,
        maxHp: 5,
        strength: 10,
        agility: 10,
        health: 10,
        level: 1,
        isAlive: true,
      },
      {
        id: 102,
        slackId: 'B',
        clientId: 'slack:B',
        clientType: 'slack',
        name: 'B',
        x: 12,
        y: 10,
        hp: 5,
        maxHp: 5,
        strength: 10,
        agility: 10,
        health: 10,
        level: 1,
        isAlive: true,
      },
    );

    const nearby = await service.getNearbyPlayers(10, 10, 'A', 5, 5);
    expect(nearby[0].distance).toBeGreaterThanOrEqual(0);
  });

  it('calculates distance helper', () => {
    const service = new PlayerService(worldService);
    expect(service.calculateDistance(0, 0, 3, 4)).toBe(5);
  });

  it('checks for active players within time threshold', async () => {
    const service = new PlayerService(worldService);

    // Add a player with recent activity
    players.push({
      id: 103,
      slackId: 'ACTIVE',
      name: 'Active',
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 10,
      strength: 10,
      agility: 10,
      health: 10,
      level: 1,
      isAlive: true,
      lastAction: new Date(),
    });

    const hasActive = await service.hasActivePlayers(30);
    expect(hasActive).toBe(true);

    // Check with old lastAction
    players[players.length - 1].lastAction = new Date(
      Date.now() - 60 * 60 * 1000,
    );
    const hasActiveOld = await service.hasActivePlayers(30);
    expect(hasActiveOld).toBe(false);
  });

  it('updates lastAction timestamp', async () => {
    const service = new PlayerService(worldService);
    await service.updateLastAction('EXIST');

    const record = players.find((p) => p.slackId === 'EXIST');
    expect(record?.lastAction).toBeDefined();
  });

  it('throws error when getPlayerByIdentifier receives no slackId or name', async () => {
    const service = new PlayerService(worldService);
    await expect(
      service.getPlayerByIdentifier({ slackId: null, name: null }),
    ).rejects.toThrow('A client ID, Slack ID, or player name must be provided');
  });

  it('gets player by name via getPlayerByIdentifier', async () => {
    const service = new PlayerService(worldService);
    const player = await service.getPlayerByIdentifier({ name: 'Existing' });
    expect(player.name).toBe('Existing');
  });

  it('throws error when movePlayer receives only x coordinate', async () => {
    const service = new PlayerService(worldService);
    await expect(
      service.movePlayer('EXIST', { x: 5 } as MovePlayerRequest),
    ).rejects.toThrow('Both x and y coordinates are required');
  });

  it('throws error when movePlayer receives only y coordinate', async () => {
    const service = new PlayerService(worldService);
    await expect(
      service.movePlayer('EXIST', { y: 5 } as MovePlayerRequest),
    ).rejects.toThrow('Both x and y coordinates are required');
  });
});
