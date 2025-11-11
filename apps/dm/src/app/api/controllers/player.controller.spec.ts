import { PlayersController } from './player.controller';
import { BadRequestException } from '@nestjs/common';
import { AttackOrigin, TargetType } from '../dto/player-requests.dto';

const createPlayerService = () => ({
  createPlayer: jest.fn(),
  getPlayer: jest.fn(),
  getAllPlayers: jest.fn(),
  getPlayersAtLocation: jest.fn(),
  updatePlayerStats: jest.fn(),
  spendSkillPoint: jest.fn(),
  rerollPlayerStats: jest.fn(),
  healPlayer: jest.fn(),
  damagePlayer: jest.fn(),
  respawnPlayer: jest.fn(),
  movePlayer: jest.fn(),
  updateLastAction: jest.fn().mockResolvedValue(undefined),
  getTopPlayers: jest.fn(),
});

const createCombatService = () => ({
  playerAttackMonster: jest.fn(),
  playerAttackPlayer: jest.fn(),
});

const noopService = () => ({});

describe('PlayersController', () => {
  let controller: PlayersController;
  let playerService: ReturnType<typeof createPlayerService>;
  let combatService: ReturnType<typeof createCombatService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    playerService = createPlayerService();
    combatService = createCombatService();
    controller = new PlayersController(
      playerService as never,
      noopService() as never,
      combatService as never,
      noopService() as never,
      noopService() as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.resetAllMocks();
  });

  it('returns failure when create payload is missing identity', async () => {
    const result = await controller.createPlayer({
      name: 'Hero',
      teamId: '',
      userId: '',
      attributes: { strength: 1, agility: 1, endurance: 1 },
    });

    expect(result).toEqual({
      success: false,
      message: 'teamId and userId are required',
    });
    expect(playerService.createPlayer).not.toHaveBeenCalled();
  });

  it('creates a player when identity is present', async () => {
    const fakePlayer = { id: 1, name: 'Hero' };
    playerService.createPlayer.mockResolvedValue(fakePlayer);

    const result = await controller.createPlayer({
      name: 'Hero',
      teamId: 'T1',
      userId: 'U1',
      attributes: { strength: 1, agility: 1, endurance: 1 },
    });

    expect(playerService.createPlayer).toHaveBeenCalledWith(
      expect.objectContaining({ teamId: 'T1', userId: 'U1' }),
    );
    expect(result).toEqual({ success: true, data: fakePlayer });
  });

  it('throws when getPlayer is missing identifiers', async () => {
    await expect(controller.getPlayer(undefined, 'U1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(controller.getPlayer('T1', undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('returns success=false when player lookup fails', async () => {
    playerService.getPlayer.mockRejectedValue(new Error('boom'));
    const result = await controller.getPlayer('T1', 'U1');
    expect(result).toEqual({
      success: false,
      message: 'boom',
    });
  });

  it('validates location query numbers', async () => {
    await expect(controller.getPlayersAtLocation('a', '2')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('updates stats when payload is valid and bubbles errors otherwise', async () => {
    const updated = { id: 1, hp: 10 };
    playerService.updatePlayerStats.mockResolvedValue(updated);

    const ok = await controller.updatePlayerStats({
      teamId: 'T1',
      userId: 'U1',
      input: { strength: 1 },
    });

    expect(ok).toEqual({ success: true, data: updated });

    playerService.updatePlayerStats.mockRejectedValue(new Error('nope'));
    const fail = await controller.updatePlayerStats({
      teamId: 'T1',
      userId: 'U1',
      input: { strength: 1 },
    });
    expect(fail).toEqual({ success: false, message: 'nope' });
  });

  it('requires attribute for spendSkillPoint', async () => {
    await expect(
      controller.spendSkillPoint({ teamId: 'T1', userId: 'U1' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('validates numeric payloads for heal/damage', async () => {
    await expect(
      controller.healPlayer({ teamId: 'T1', userId: 'U1', amount: 'x' } as never),
    ).rejects.toThrow('amount must be a number');

    await expect(
      controller.damagePlayer({
        teamId: 'T1',
        userId: 'U1',
        damage: 'bad',
      } as never),
    ).rejects.toThrow('damage must be a number');
  });

  it('throws when attack payload is missing required fields', async () => {
    await expect(
      controller.attack({
        teamId: undefined,
        userId: 'U1',
        input: { targetType: TargetType.MONSTER },
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      controller.attack({
        teamId: 'T1',
        userId: 'U1',
        input: undefined as never,
      }),
    ).rejects.toThrow('input is required');
  });

  it('routes monster attacks to combatService and reports perf metrics', async () => {
    const combatResult = { winner: 'Hero', perfBreakdown: { totalMs: 5 } };
    combatService.playerAttackMonster.mockResolvedValue(combatResult);

    const response = await controller.attack({
      teamId: 'T1',
      userId: 'U1',
      input: { targetType: TargetType.MONSTER, targetId: 100 },
    });

    expect(combatService.playerAttackMonster).toHaveBeenCalledWith(
      { teamId: 'T1', userId: 'U1' },
      100,
      { attackOrigin: AttackOrigin.TEXT_PVE },
    );
    expect(response.success).toBe(true);
    expect(response.perf.attackOrigin).toBe(AttackOrigin.TEXT_PVE);
    expect(response.data).toEqual(combatResult);
  });

  it('routes player attacks with ignoreLocation flag', async () => {
    const combatResult = { winner: 'Hero' };
    combatService.playerAttackPlayer.mockResolvedValue(combatResult);

    const response = await controller.attack({
      teamId: 'T1',
      userId: 'U1',
      input: {
        targetType: TargetType.PLAYER,
        targetTeamId: 'T2',
        targetUserId: 'U2',
        ignoreLocation: true,
        attackOrigin: AttackOrigin.DROPDOWN_PVP,
      },
    });

    expect(combatService.playerAttackPlayer).toHaveBeenCalledWith(
      { teamId: 'T1', userId: 'U1' },
      { teamId: 'T2', userId: 'U2' },
      true,
      { attackOrigin: AttackOrigin.DROPDOWN_PVP },
    );
    expect(response.success).toBe(true);
    expect(response.perf.attackOrigin).toBe(AttackOrigin.DROPDOWN_PVP);
  });
});
