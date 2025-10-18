// Ensure env is mocked before importing the service under test
jest.mock('../../env', () => ({
  env: {
    OPENAI_API_KEY: 'test-openai-key',
    DATABASE_URL: 'postgresql://test',
    WORLD_SERVICE_URL: 'http://world.test/world',
    REDIS_URL: 'redis://localhost:6379',
    COORDINATION_PREFIX: 'dm:coord:',
    TILE_DESC_LOCK_TTL_MS: 15000,
    TILE_DESC_COOLDOWN_MS: 300000,
    TILE_DESC_MIN_RETRY_MS: 30000,
    MOVEMENT_ACTIVE_RADIUS: 1000,
    MOVEMENT_PARTITIONS: 1,
    MOVEMENT_CONCURRENCY: 10,
    MOVEMENT_CHANCE: 1,
    MOVEMENT_BUDGET: 100,
  },
}));

import { GameTickService } from './game-tick.service';
import type { PlayerService } from '../player/player.service';
import type { PopulationService } from '../monster/population.service';
import type { MonsterService } from '../monster/monster.service';
import { EventBus } from '@mud/engine';

jest.mock('@mud/engine', () => ({
  EventBus: {
    emit: jest.fn(),
  },
}));

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock() {
  let currentGameState: Record<string, unknown> | null = null;
  let weatherState: Record<string, unknown> | null = null;

  const prisma = {
    gameState: {
      findFirst: jest.fn().mockImplementation(async () => currentGameState),
      create: jest.fn().mockImplementation(async ({ data }) => {
        currentGameState = { id: 1, ...data };
        return currentGameState;
      }),
      update: jest.fn().mockImplementation(async ({ data }) => {
        currentGameState = { ...currentGameState, ...data };
        return currentGameState;
      }),
    },
    weatherState: {
      findFirst: jest.fn().mockImplementation(async () => weatherState),
      create: jest.fn().mockImplementation(async ({ data }) => {
        weatherState = { id: 1, ...data };
        return weatherState;
      }),
      update: jest.fn().mockImplementation(async ({ data }) => {
        weatherState = { ...weatherState, ...data };
        return weatherState;
      }),
    },
  };

  return {
    prisma,
    setGameState: (state: Record<string, unknown> | null) =>
      (currentGameState = state),
    getGameState: () => currentGameState,
    setWeatherState: (state: Record<string, unknown> | null) =>
      (weatherState = state),
  };
}

type GameTickPrismaHolder = {
  prisma?: PrismaMock['prisma'];
  controller?: ReturnType<typeof createPrismaMock>;
};

function ensureGameTickPrismaHolder(): GameTickPrismaHolder {
  const globalObject = globalThis as Record<string, unknown>;
  const key = '__gameTickPrismaHolder';
  if (!globalObject[key]) {
    globalObject[key] = {};
  }

  return globalObject[key] as GameTickPrismaHolder;
}

jest.mock('@mud/database', () => ({
  getPrismaClient: () => {
    const holder = ensureGameTickPrismaHolder();
    if (!holder.controller) {
      const controller = createPrismaMock();
      holder.controller = controller;
      holder.prisma = controller.prisma;
    }

    return holder.prisma;
  },
}));

const gameTickPrismaHolder = ensureGameTickPrismaHolder();

describe('GameTickService', () => {
  const createService = () => {
    const playerService = {
      getAllPlayers: jest.fn().mockResolvedValue([
        {
          clientId: 'client-U1',
          slackId: 'U1',
          position: { x: 1, y: 1 },
          combat: { isAlive: true },
        },
      ]),
      getPlayersAtLocation: jest.fn().mockResolvedValue([
        {
          clientId: 'client-U1',
          slackId: 'U1',
          position: { x: 1, y: 1 },
          combat: { isAlive: true },
        },
      ]),
    } as unknown as {
      getAllPlayers: jest.Mock;
      getPlayersAtLocation: jest.Mock;
    };
    const populationService = {
      enforceDensityAround: jest.fn().mockResolvedValue({
        spawned: 2,
        report: [
          {
            biome: 'forest',
            tiles: 10,
            targetPer1000: 4,
            targetCount: 1,
            current: 0,
            deficit: 1,
            spawned: 2,
          },
        ],
      }),
    } as unknown as { enforceDensityAround: jest.Mock };
    const monsterService = {
      getMonstersInBounds: jest.fn().mockResolvedValue([
        { id: 1, position: { x: 1, y: 1 } },
        { id: 2, position: { x: 2, y: 2 } },
      ]),
      getMonstersAtLocation: jest
        .fn()
        .mockResolvedValue([
          { id: 1, position: { x: 1, y: 1 }, name: 'Goblin' },
        ]),
      moveMonster: jest.fn().mockResolvedValue(undefined),
      cleanupDeadMonsters: jest.fn().mockResolvedValue(undefined),
    } as unknown as {
      getMonstersInBounds: jest.Mock;
      getMonstersAtLocation: jest.Mock;
      moveMonster: jest.Mock;
      cleanupDeadMonsters: jest.Mock;
    };

    const service = new GameTickService(
      playerService as unknown as PlayerService,
      populationService as unknown as PopulationService,
      monsterService as unknown as MonsterService,
    );

    return {
      service,
      playerService,
      populationService,
      monsterService,
    };
  };

  beforeEach(() => {
    gameTickPrismaHolder.controller = undefined;
    gameTickPrismaHolder.prisma = undefined;
    // Random usage order now:
    // 1) candidate shuffle
    // 2) movement chance (candidate 1)
    // 3) movement chance (candidate 2)
    // 4) combat chance (must be < 0.2 to trigger)
    const randomValues = [
      0.6, // shuffle
      0.5, // movement (candidate 1) => move
      0.5, // movement (candidate 2) => move
      0.1, // combat chance (trigger)
      0.4, // weather / subsequent randomness
      0.3,
      0.6,
      0.1,
      0.2, // ensure weather pressureChange < 0.5 so state changes from clear
      0.9,
      0.4,
      0.5,
      0.5,
    ];
    jest
      .spyOn(global.Math, 'random')
      .mockImplementation(() =>
        randomValues.length ? randomValues.shift()! : 0.1,
      );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    (EventBus.emit as jest.Mock).mockReset();
  });

  it('processes ticks and updates weather', async () => {
    const { service, populationService, monsterService } = createService();
    // First tick with no existing game state
    const result1 = await service.processTick();
    expect(result1.tick).toBe(1);
    expect(populationService.enforceDensityAround).toHaveBeenCalled();
    // Movement is gated by partition/budget/chance; ensure we attempted movement on some candidate
    expect(
      (monsterService.moveMonster as jest.Mock).mock.calls.some(
        ([id]: [number]) => [1, 2].includes(id),
      ),
    ).toBe(true);
    const combatCalls = (EventBus.emit as jest.Mock).mock.calls.filter(
      ([event]) => event.eventType === 'combat:initiate',
    );
    expect(combatCalls).toHaveLength(1);
    expect(combatCalls[0][0]).toMatchObject({
      attacker: expect.objectContaining({ id: 1, type: 'monster' }),
      defender: expect.objectContaining({ id: 'client-U1', type: 'player' }),
      metadata: expect.objectContaining({ source: 'game-tick.service' }),
    });

    (EventBus.emit as jest.Mock).mockClear();

    // Prepare for weather update at tick 4
    gameTickPrismaHolder.controller?.setGameState({
      id: 1,
      tick: 3,
      gameHour: 0,
      gameDay: 1,
    });
    gameTickPrismaHolder.controller?.setWeatherState({
      id: 1,
      state: 'clear',
      pressure: 1015,
    });

    const result2 = await service.processTick();
    expect(result2.weatherUpdated).toBe(true);
    const weatherCalls = (EventBus.emit as jest.Mock).mock.calls.filter(
      ([event]) => event.eventType === 'world:weather:change',
    );
    expect(weatherCalls.length).toBeGreaterThanOrEqual(1);

    (EventBus.emit as jest.Mock).mockClear();

    // Prepare for cleanup branch at tick 10
    gameTickPrismaHolder.controller?.setGameState({
      id: 1,
      tick: 9,
      gameHour: 1,
      gameDay: 1,
    });
    const result3 = await service.processTick();
    expect(monsterService.cleanupDeadMonsters).toHaveBeenCalled();
    expect(result3.tick).toBe(10);
  });

  it('returns combined game state snapshot', async () => {
    const { service } = createService();
    gameTickPrismaHolder.controller?.setGameState({
      id: 1,
      tick: 5,
      gameHour: 2,
      gameDay: 1,
    });

    const snapshot = await service.getGameState();
    expect(snapshot).toHaveProperty('gameState');
    expect(snapshot).toHaveProperty('weather');
  });
});
