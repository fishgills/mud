import { PlayerService } from './player.service';
import { GraphQLError } from 'graphql';

const players: any[] = [];

jest.mock('@mud/database', () => ({
  getPrismaClient: () => ({
    player: {
      findUnique: jest.fn(
        async ({ where: { slackId } }) =>
          players.find((p) => p.slackId === slackId) ?? null,
      ),
      findMany: jest.fn(async (args: any = {}) => {
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
            const selected: any = {};
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
      count: jest.fn(async (args: any = {}) => {
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
          ...data,
        };
        players.push(player);
        return player;
      }),
      update: jest.fn(async ({ where: { slackId }, data }) => {
        const idx = players.findIndex((p) => p.slackId === slackId);
        if (idx === -1) throw new Error('not found');
        players[idx] = { ...players[idx], ...data };
        return players[idx];
      }),
      delete: jest.fn(async ({ where: { slackId } }) => {
        const idx = players.findIndex((p) => p.slackId === slackId);
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
  } as any;

  beforeEach(() => {
    players.length = 0;
    players.push({
      id: 99,
      slackId: 'EXIST',
      name: 'Existing',
      x: 100,
      y: 100,
      hp: 10,
      maxHp: 10,
      strength: 10,
      agility: 10,
      health: 10,
      level: 1,
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
    } as any);
    expect(created.slackId).toBe('U1');

    await expect(
      service.createPlayer({ slackId: 'U1', name: 'Hero', x: 0, y: 0 } as any),
    ).rejects.toThrow(GraphQLError);
  });

  it('gets players by slack and name with error handling', async () => {
    const service = new PlayerService(worldService);
    const player = await service.getPlayer('EXIST');
    expect(player.name).toBe('Existing');

    await expect(service.getPlayer('UNKNOWN')).rejects.toThrow();

    await expect(service.getPlayerByName(' ')).rejects.toThrow(GraphQLError);
    await expect(service.getPlayerByName('missing')).rejects.toThrow();

    players.push({ ...players[0], id: 100, slackId: 'EX2', name: 'Existing' });
    await expect(service.getPlayerByName('Existing')).rejects.toThrow(
      GraphQLError,
    );
  });

  it('moves players and validates movement', async () => {
    const service = new PlayerService(worldService);
    const moved = await service.movePlayer('EXIST', {
      direction: 'east',
    } as any);
    expect(moved.x).toBe(101);

    await expect(service.movePlayer('EXIST', { x: 1 } as any)).rejects.toThrow(
      'Both x and y',
    );

    await expect(
      service.movePlayer('EXIST', { direction: 'invalid' } as any),
    ).rejects.toThrow('Invalid direction');

    await expect(
      service.movePlayer('EXIST', { direction: 'north' } as any),
    ).rejects.toThrow('water');
  });

  it('updates stats, rerolls, heals and damages', async () => {
    const service = new PlayerService(worldService);
    const updated = await service.updatePlayerStats('EXIST', {
      hp: 5,
      xp: 10,
      gold: 3,
      level: 2,
    } as any);
    expect(updated.hp).toBe(5);

    players[0].hp = 1;
    const rerolled = await service.rerollPlayerStats('EXIST');
    expect(rerolled.maxHp).toBeGreaterThan(0);

    const healed = await service.healPlayer('EXIST', 5);
    expect(healed.hp).toBeLessThanOrEqual(healed.maxHp);

    const damaged = await service.damagePlayer('EXIST', 200);
    expect(damaged.isAlive).toBe(false);
  });

  it('respawns, deletes, and finds players nearby', async () => {
    const service = new PlayerService(worldService);
    const respawned = await service.respawnPlayer('EXIST');
    expect(respawned.isAlive).toBe(true);

    const removed = await service.deletePlayer('EXIST');
    expect(removed.slackId).toBe('EXIST');

    players.push(
      {
        id: 101,
        slackId: 'A',
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

    const player = await service.getPlayer('EXIST');
    expect(player.lastAction).toBeDefined();
  });

  it('throws error when getPlayerByIdentifier receives no slackId or name', async () => {
    const service = new PlayerService(worldService);
    await expect(
      service.getPlayerByIdentifier({ slackId: null, name: null }),
    ).rejects.toThrow('A Slack ID or player name must be provided');
  });

  it('gets player by name via getPlayerByIdentifier', async () => {
    const service = new PlayerService(worldService);
    const player = await service.getPlayerByIdentifier({ name: 'Existing' });
    expect(player.name).toBe('Existing');
  });

  it('throws error when movePlayer receives only x coordinate', async () => {
    const service = new PlayerService(worldService);
    await expect(service.movePlayer('EXIST', { x: 5 } as any)).rejects.toThrow(
      'Both x and y coordinates are required',
    );
  });

  it('throws error when movePlayer receives only y coordinate', async () => {
    const service = new PlayerService(worldService);
    await expect(service.movePlayer('EXIST', { y: 5 } as any)).rejects.toThrow(
      'Both x and y coordinates are required',
    );
  });

  describe('Level-up system', () => {
    it('should level up player when XP threshold is reached', async () => {
      const service = new PlayerService(worldService);
      
      // Create a player with enough XP to level up (100 XP = level 2)
      players.push({
        id: 999,
        slackId: 'LEVELUP',
        name: 'Leveler',
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        strength: 10,
        agility: 10,
        health: 10,
        gold: 0,
        xp: 150, // Enough for level 2 (100 XP needed)
        level: 1,
        skillPoints: 0,
        isAlive: true,
      });

      const result = await service.checkAndApplyLevelUp('LEVELUP');
      
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(2);
      expect(result.healthGained).toBe(10); // 10 HP per level
      expect(result.skillPointsGained).toBe(0); // No skill points at level 2 (only every 3 levels)
    });

    it('should award skill points every 3 levels', async () => {
      const service = new PlayerService(worldService);
      
      // Create a player with enough XP to reach level 3 (300 XP)
      players.push({
        id: 1000,
        slackId: 'SKILLUP',
        name: 'Skilled',
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        strength: 10,
        agility: 10,
        health: 10,
        gold: 0,
        xp: 350, // Enough for level 3 (300 XP needed)
        level: 1,
        skillPoints: 0,
        isAlive: true,
      });

      const result = await service.checkAndApplyLevelUp('SKILLUP');
      
      expect(result.leveledUp).toBe(true);
      expect(result.newLevel).toBe(3);
      expect(result.skillPointsGained).toBe(1); // 1 skill point at level 3
    });

    it('should increase skill and consume skill point', async () => {
      const service = new PlayerService(worldService);
      
      // Create a player with a skill point
      players.push({
        id: 1001,
        slackId: 'INCREASE',
        name: 'Increaser',
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        strength: 10,
        agility: 10,
        health: 10,
        gold: 0,
        xp: 0,
        level: 3,
        skillPoints: 1,
        isAlive: true,
      });

      const player = await service.increaseSkill('INCREASE', 'strength');
      
      expect(player.strength).toBe(11);
      expect(player.skillPoints).toBe(0);
    });

    it('should throw error when trying to increase skill without skill points', async () => {
      const service = new PlayerService(worldService);
      
      // Create a player without skill points
      players.push({
        id: 1002,
        slackId: 'NOPOINTS',
        name: 'NoPoints',
        x: 0,
        y: 0,
        hp: 100,
        maxHp: 100,
        strength: 10,
        agility: 10,
        health: 10,
        gold: 0,
        xp: 0,
        level: 1,
        skillPoints: 0,
        isAlive: true,
      });

      await expect(service.increaseSkill('NOPOINTS', 'strength')).rejects.toThrow(
        'You have no skill points available to spend',
      );
    });
  });
});
