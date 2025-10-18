import { GameTickService } from './game-tick.service';
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
      getAllMonsters: jest.fn().mockResolvedValue([
        { id: 1, position: { x: 1, y: 1 } },
        { id: 2, position: { x: 2, y: 2 } },
      ]),
      moveMonster: jest.fn().mockResolvedValue(undefined),
      cleanupDeadMonsters: jest.fn().mockResolvedValue(undefined),
    } as unknown as {
      getAllMonsters: jest.Mock;
      moveMonster: jest.Mock;
      cleanupDeadMonsters: jest.Mock;
    };

    const service = new GameTickService(
      playerService,
      populationService,
      monsterService,
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
    const randomValues = [
      0.3,
      0.6, // monster move checks
      0.1,
      0.9, // combat chances
      0.2,
      0.4, // weather change and branch
      0.3,
      0.6,
      0.1,
      0.9,
      0.2,
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
    expect(monsterService.moveMonster).toHaveBeenCalledWith(1);
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
