import { PlayerService } from './player.service';
import { EventBus } from '../../shared/event-bus';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

const mockPrisma = {
  player: {
    count: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    delete: jest.fn(),
  },
  slackUser: {
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockFindPlayerBySlackUser = jest.fn();

jest.mock('@mud/database', () => {
  const actual = jest.requireActual('@mud/database');
  return {
    ...actual,
    getPrismaClient: () => mockPrisma,
    findPlayerBySlackUser: (...args: unknown[]) =>
      mockFindPlayerBySlackUser(...args),
  };
});

let diceQueue: number[] = [];

jest.mock('@dice-roller/rpg-dice-roller', () => ({
  DiceRoll: jest.fn().mockImplementation(() => ({
    total: diceQueue.length > 0 ? (diceQueue.shift() as number) : 12,
  })),
}));

const createPlayerItemService = () => ({
  getEquipmentTotals: jest.fn().mockResolvedValue({
    attackBonus: 0,
    damageBonus: 0,
    armorBonus: 0,
    vitalityBonus: 0,
  }),
});

const makePlayer = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    name: 'Hero',
    hp: 10,
    maxHp: 10,
    agility: 12,
    strength: 12,
    health: 10,
    level: 1,
    xp: 0,
    gold: 0,
    skillPoints: 0,
    isAlive: true,
    isCreationComplete: true,
    lastAction: new Date(),
    lastActiveAt: new Date(),
    hasStartedGame: false,
    hasMoved: false,
    hasBattled: false,
    hasDefeatedMonster: false,
    totalCommandsExecuted: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as any;

describe('PlayerService', () => {
  let service: PlayerService;
  let playerItemService: ReturnType<typeof createPlayerItemService>;
  let eventBusEmitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    jest.clearAllMocks();
    diceQueue = [];
    playerItemService = createPlayerItemService();
    service = new PlayerService(playerItemService as never);
    eventBusEmitSpy = jest.spyOn(EventBus, 'emit').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates a player and slack user record', async () => {
    mockFindPlayerBySlackUser.mockRejectedValueOnce(new NotFoundException());
    const created = makePlayer();
    mockPrisma.player.create.mockResolvedValue(created);
    mockPrisma.slackUser.create.mockResolvedValue({ id: 2 });

    const result = await service.createPlayer({
      teamId: 'T1',
      userId: 'U1',
      name: 'Hero',
    });

    expect(mockPrisma.player.create).toHaveBeenCalled();
    expect(mockPrisma.slackUser.create).toHaveBeenCalledWith({
      data: { teamId: 'T1', userId: 'U1', playerId: created.id },
    });
    expect(result).toBe(created);
  });

  it('rejects duplicate player creation', async () => {
    mockFindPlayerBySlackUser.mockResolvedValueOnce(makePlayer());
    await expect(
      service.createPlayer({ teamId: 'T1', userId: 'U1', name: 'Hero' }),
    ).rejects.toThrow(ConflictException);
  });

  it('requires teamId and userId for createPlayer', async () => {
    await expect(
      service.createPlayer({ teamId: 'T1', name: 'Hero' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('enforces creation completion when requested', async () => {
    mockFindPlayerBySlackUser.mockResolvedValueOnce(
      makePlayer({ isCreationComplete: false }),
    );
    await expect(
      service.getPlayer('T1', 'U1', { requireCreationComplete: true }),
    ).rejects.toThrow(BadRequestException);
  });

  it('respawns a player and emits event', async () => {
    const player = makePlayer({ isAlive: false, hp: 0 });
    mockFindPlayerBySlackUser.mockResolvedValueOnce(player);
    mockPrisma.player.update.mockResolvedValue(undefined);
    mockPrisma.player.findUnique.mockResolvedValue({
      ...player,
      slackUser: { teamId: 'T1', userId: 'U1' },
    });

    const result = await service.respawnPlayer('T1', 'U1');

    expect(result.isAlive).toBe(true);
    expect(result.hp).toBe(result.maxHp);
    expect(eventBusEmitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'player:respawn' }),
    );
  });

  it('emits player:death when damage kills the player', async () => {
    const player = makePlayer({ hp: 2, isAlive: true });
    mockFindPlayerBySlackUser.mockResolvedValueOnce(player);
    mockPrisma.player.update.mockResolvedValue(undefined);
    mockPrisma.player.findUnique.mockResolvedValue(player);

    const result = await service.damagePlayer('T1', 'U1', 5);
    expect(result.isAlive).toBe(false);
    expect(eventBusEmitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'player:death' }),
    );
  });
});
