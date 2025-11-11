import { GameTickService } from './game-tick.service';
import type { PlayerService } from '../player/player.service';
import type { PopulationService } from '../monster/population.service';
import type { MonsterService } from '../monster/monster.service';
import { EventBus } from '../../shared/event-bus';
import { env } from '../../env';

const mockPrisma = {
  gameState: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  weatherState: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@mud/database', () => {
  const actual = jest.requireActual<typeof import('@mud/database')>(
    '@mud/database',
  );
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
  };
});

describe('GameTickService', () => {
  let service: GameTickService;
  let playerService: jest.Mocked<PlayerService>;
  let populationService: jest.Mocked<PopulationService>;
  let monsterService: jest.Mocked<MonsterService>;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.spyOn(Math, 'random').mockReturnValue(1);
    playerService = {
      getActivePlayers: jest.fn().mockResolvedValue([]),
      getAllPlayers: jest.fn(),
    } as unknown as jest.Mocked<PlayerService>;
    populationService = {
      enforceDensityAround: jest.fn().mockResolvedValue({ spawned: 0, report: [] }),
    } as unknown as jest.Mocked<PopulationService>;
    monsterService = {
      getMonstersInBounds: jest.fn().mockResolvedValue([]),
      moveMonster: jest.fn(),
    } as unknown as jest.Mocked<MonsterService>;
    service = new GameTickService(
      playerService,
      populationService,
      monsterService,
    );
    emitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue(undefined);
    mockPrisma.gameState.findFirst.mockReset();
    mockPrisma.gameState.create.mockReset();
    mockPrisma.gameState.update.mockReset();
    mockPrisma.weatherState.findFirst.mockReset();
    mockPrisma.weatherState.create.mockReset();
    mockPrisma.weatherState.update.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('initializes missing game state and emits tick', async () => {
    mockPrisma.gameState.findFirst.mockResolvedValueOnce(null);
    mockPrisma.gameState.create.mockResolvedValueOnce({
      id: 1,
      tick: 0,
      gameHour: 0,
      gameDay: 1,
    });

    const result = await service.processTick();

    expect(mockPrisma.gameState.create).toHaveBeenCalled();
    expect(mockPrisma.gameState.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { tick: 1, gameHour: 0, gameDay: 1 },
    });
    expect(result).toEqual(
      expect.objectContaining({
        tick: 1,
        weatherUpdated: false,
      }),
    );
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'world:time:tick', tick: 1 }),
    );
  });

  it('handles hourly/day rollover, density enforcement, and weather updates', async () => {
    mockPrisma.gameState.findFirst.mockResolvedValueOnce({
      id: 2,
      tick: 3,
      gameHour: 23,
      gameDay: 1,
    });
    const weatherChange = { oldState: 'sunny', newState: 'rain' };
    jest
      .spyOn(service as unknown as { updateWeather: () => Promise<any> }, 'updateWeather')
      .mockResolvedValueOnce(weatherChange);

    playerService.getActivePlayers.mockResolvedValueOnce([
      { isAlive: true, x: 0, y: 0 },
    ] as any);
    populationService.enforceDensityAround.mockResolvedValueOnce({
      spawned: 2,
      report: [],
    });
    monsterService.getMonstersInBounds.mockResolvedValueOnce([]);

    const result = await service.processTick();

    expect(mockPrisma.gameState.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { tick: 4, gameHour: 0, gameDay: 2 },
    });
    expect(populationService.enforceDensityAround).toHaveBeenCalled();
    expect(result.weatherUpdated).toBe(true);
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'world:weather:change' }),
    );
  });

  it('skips monster updates when no players are recently active', async () => {
    mockPrisma.gameState.findFirst.mockResolvedValueOnce({
      id: 5,
      tick: 1,
      gameHour: 5,
      gameDay: 1,
    });
    playerService.getActivePlayers.mockResolvedValueOnce([]);

    const result = await service.processTick();

    expect(populationService.enforceDensityAround).not.toHaveBeenCalled();
    expect(monsterService.getMonstersInBounds).not.toHaveBeenCalled();
    expect(result.monstersSpawned).toBe(0);
    expect(result.monstersMoved).toBe(0);
  });
});
