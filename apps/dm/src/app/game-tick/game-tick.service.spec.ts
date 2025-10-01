import { GameTickService } from './game-tick.service';

type PrismaMock = ReturnType<typeof createPrismaMock>;

function createPrismaMock() {
  let currentGameState: any = null;
  let weatherState: any = null;

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

  return { prisma, setGameState: (state: any) => (currentGameState = state), getGameState: () => currentGameState };
}

const prismaHolder: { prisma?: PrismaMock['prisma']; controller?: ReturnType<typeof createPrismaMock> } = {};

jest.mock('@mud/database', () => ({
  getPrismaClient: () => {
    if (!prismaHolder.controller) {
      prismaHolder.controller = createPrismaMock();
      prismaHolder.prisma = prismaHolder.controller.prisma;
    }
    return prismaHolder.prisma;
  },
}));

describe('GameTickService', () => {
  const createService = () => {
    const combatService = {
      monsterAttackPlayer: jest.fn(),
    } as any;
    const playerService = {
      getAllPlayers: jest.fn().mockResolvedValue([
        { slackId: 'U1', x: 1, y: 1, isAlive: true },
      ]),
      getPlayersAtLocation: jest.fn().mockResolvedValue([
        { slackId: 'U1', isAlive: true },
      ]),
    } as any;
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
    } as any;
    const monsterService = {
      getAllMonsters: jest.fn().mockResolvedValue([
        { id: 1, x: 1, y: 1 },
        { id: 2, x: 2, y: 2 },
      ]),
      moveMonster: jest.fn().mockResolvedValue(undefined),
      cleanupDeadMonsters: jest.fn().mockResolvedValue(undefined),
    } as any;

    const service = new GameTickService(
      combatService,
      playerService,
      populationService,
      monsterService,
    );

    return {
      service,
      combatService,
      playerService,
      populationService,
      monsterService,
    };
  };

  beforeEach(() => {
    prismaHolder.controller = undefined;
    prismaHolder.prisma = undefined;
    const randomValues = [
      0.3, 0.6, // monster move checks
      0.1, 0.9, // combat chances
      0.2, 0.4, // weather change and branch
      0.3, 0.6,
      0.1, 0.9,
      0.2, 0.4,
      0.5, 0.5,
    ];
    jest
      .spyOn(global.Math, 'random')
      .mockImplementation(() => (randomValues.length ? randomValues.shift()! : 0.1));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('processes ticks and updates weather', async () => {
    const { service, populationService, monsterService, combatService } = createService();
    // First tick with no existing game state
    const result1 = await service.processTick();
    expect(result1.tick).toBe(1);
    expect(populationService.enforceDensityAround).toHaveBeenCalled();
    expect(monsterService.moveMonster).toHaveBeenCalledWith(1);
    expect(combatService.monsterAttackPlayer).toHaveBeenCalledWith(1, 'U1');

    // Prepare for weather update at tick 4
    prismaHolder.controller?.setGameState({
      id: 1,
      tick: 3,
      gameHour: 0,
      gameDay: 1,
    });
    const result2 = await service.processTick();
    expect(result2.weatherUpdated).toBe(true);

    // Prepare for cleanup branch at tick 10
    prismaHolder.controller?.setGameState({
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
    prismaHolder.controller?.setGameState({
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
