import { PlayersController } from './player.controller';
import { BadRequestException } from '@nestjs/common';
import { AttackOrigin, TargetType } from '../dto/player-requests.dto';
import { AppError, ErrCodes } from '../../errors/app-error';

const createPlayerService = () => ({
  createPlayer: jest.fn(),
  getPlayer: jest.fn(),
  findPlayerByName: jest.fn(),
  getAllPlayers: jest.fn(),
  updatePlayerStats: jest.fn(),
  spendSkillPoint: jest.fn(),
  rerollPlayerStats: jest.fn(),
  healPlayer: jest.fn(),
  damagePlayer: jest.fn(),
  respawnPlayer: jest.fn(),
  updateLastAction: jest.fn().mockResolvedValue(undefined),
  getTopPlayers: jest.fn(),
  deletePlayer: jest.fn(),
  recalculatePlayerHitPointsFromEquipment: jest.fn(),
});

const createCombatService = () => ({
  playerAttackMonster: jest.fn(),
  playerAttackPlayer: jest.fn(),
  getRecentCombatForPlayer: jest.fn(),
});

const createPlayerItemService = () => ({
  getEquipmentTotals: jest.fn(),
  listBag: jest.fn(),
  equip: jest.fn(),
  unequip: jest.fn(),
});

const createRunsService = () => ({
  ensurePlayerNotInRun: jest.fn(),
});

const createEventBridgeService = () => ({
  publishPlayerNotification: jest.fn(),
});

describe('PlayersController', () => {
  let controller: PlayersController;
  let playerService: ReturnType<typeof createPlayerService>;
  let combatService: ReturnType<typeof createCombatService>;
  let playerItemService: ReturnType<typeof createPlayerItemService>;
  let runsService: ReturnType<typeof createRunsService>;
  let eventBridge: ReturnType<typeof createEventBridgeService>;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2024-01-01T00:00:00Z'));
    playerService = createPlayerService();
    combatService = createCombatService();
    playerItemService = createPlayerItemService();
    runsService = createRunsService();
    eventBridge = createEventBridgeService();
    controller = new PlayersController(
      playerService as never,
      combatService as never,
      playerItemService as never,
      runsService as never,
      eventBridge as never,
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

  it('returns leaderboard data and surfaces failures', async () => {
    const players = [{ id: 1 }];
    playerService.getTopPlayers.mockResolvedValue(players as never);

    const success = await controller.getLeaderboard('5', 'T1');
    expect(success).toEqual({ success: true, data: players });
    expect(playerService.getTopPlayers).toHaveBeenCalledWith(5, 'T1');

    playerService.getTopPlayers.mockRejectedValue(new Error('nope'));
    const failure = await controller.getLeaderboard('5');
    expect(failure).toEqual({ success: false });
  });

  it('returns player data with equipment totals', async () => {
    const player = { id: 7, name: 'Hero' };
    playerService.getPlayer.mockResolvedValue(player as never);
    playerItemService.getEquipmentTotals.mockResolvedValue({ attackBonus: 2 });

    const response = await controller.getPlayer('T1', 'U1');

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      id: 7,
      equipmentTotals: { attackBonus: 2 },
    });
  });

  it('lists all players', async () => {
    const all = [{ id: 1 }];
    playerService.getAllPlayers.mockResolvedValue(all as never);
    expect(await controller.getAllPlayers()).toBe(all);
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

  it('requires identity when updating stats', async () => {
    await expect(
      controller.updatePlayerStats({ userId: 'U1', input: {} }),
    ).rejects.toThrow('teamId and userId are required');
  });

  it('requires attribute for spendSkillPoint', async () => {
    await expect(
      controller.spendSkillPoint({ teamId: 'T1', userId: 'U1' } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('spends skill points, rerolls, heals, damages, respawns, and deletes', async () => {
    const player = { id: 1, name: 'Hero' };
    playerService.spendSkillPoint.mockResolvedValue(player as never);
    expect(
      await controller.spendSkillPoint({
        teamId: 'T1',
        userId: 'U1',
        attribute: 'strength',
      }),
    ).toEqual({ success: true, data: player });

    playerService.rerollPlayerStats.mockResolvedValue(player as never);
    expect(
      await controller.rerollPlayerStats({ teamId: 'T1', userId: 'U1' }),
    ).toEqual({ success: true, data: player });

    playerService.healPlayer.mockResolvedValue({ ...player, hp: 5 } as never);
    expect(
      await controller.healPlayer({ teamId: 'T1', userId: 'U1', amount: 5 }),
    ).toEqual({ success: true, data: { ...player, hp: 5 } });

    playerService.damagePlayer.mockResolvedValue({ ...player, hp: 0 } as never);
    expect(
      await controller.damagePlayer({ teamId: 'T1', userId: 'U1', damage: 2 }),
    ).toEqual({ success: true, data: { ...player, hp: 0 } });

    playerService.respawnPlayer.mockResolvedValue(player as never);
    expect(await controller.respawn({ teamId: 'T1', userId: 'U1' })).toEqual({
      success: true,
      data: player,
      message: 'You have been resurrected!',
    });

    playerService.deletePlayer.mockResolvedValue(player as never);
    expect(await controller.deletePlayer('U1', 'T1')).toEqual({
      success: true,
      data: player,
      message: 'Player deleted successfully',
    });
  });

  it('validates numeric payloads for heal/damage', async () => {
    await expect(
      controller.healPlayer({
        teamId: 'T1',
        userId: 'U1',
        amount: 'x',
      } as never),
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

  it('rejects monster combat requests outside raids', async () => {
    const response = await controller.attack({
      teamId: 'T1',
      userId: 'U1',
      input: { targetType: TargetType.MONSTER, targetId: 100 },
    });

    expect(response.success).toBe(false);
    expect(response.message).toBe(
      'PvE combat is only available through raids.',
    );
  });

  it('routes player duels through combat service', async () => {
    const combatResult = { winner: 'Hero' };
    combatService.playerAttackPlayer.mockResolvedValue(combatResult);

    const response = await controller.attack({
      teamId: 'T1',
      userId: 'U1',
      input: {
        targetType: TargetType.PLAYER,
        targetTeamId: 'T1',
        targetUserId: 'U2',
      },
    });

    expect(combatService.playerAttackPlayer).toHaveBeenCalledWith(
      { teamId: 'T1', userId: 'U1' },
      { teamId: 'T1', userId: 'U2' },
      { attackOrigin: AttackOrigin.TEXT_PVP },
    );
    expect(response.success).toBe(true);
    expect(response.data).toEqual(combatResult);
  });

  it('returns stats with derived modifiers and combat logs', async () => {
    const player = {
      id: 1,
      strength: 14,
      agility: 12,
      health: 10,
      level: 3,
      xp: 250,
    };
    playerService.getPlayer.mockResolvedValue(player as never);
    playerItemService.getEquipmentTotals.mockResolvedValue({
      attackBonus: 2,
      damageBonus: 1,
      armorBonus: 3,
      vitalityBonus: 0,
      weaponDamageRoll: '1d6',
    });
    combatService.getRecentCombatForPlayer.mockResolvedValue([{ id: 1 }]);

    const stats = await controller.getPlayerStats('T1', 'U1');
    expect(stats.combat.strength).toBe(17);
    expect(stats.combat.health).toBe(13);
    expect(stats.combat.weaponDamageRoll).toBe('1d6');
    expect(stats.xpNeeded).toBeGreaterThanOrEqual(0);
    expect(combatService.getRecentCombatForPlayer).toHaveBeenCalledWith(1);
  });

  it('lists player items and surfaces bag/allowed slot metadata', async () => {
    const player = { id: 1, name: 'Hero' };
    playerService.getPlayer.mockResolvedValue(player as never);
    playerItemService.getEquipmentTotals.mockResolvedValue({ armorBonus: 1 });
    playerItemService.listBag.mockResolvedValue([
      {
        id: 10,
        playerId: 1,
        itemId: 5,
        equipped: false,
        quality: 'Common',
        item: { type: 'weapon', name: 'Sword', damageRoll: '1d6' },
      },
    ] as never);

    const response = await controller.getPlayerItems('T1', 'U1');
    expect(response.success).toBe(true);
    expect(response.data?.bag?.[0]).toMatchObject({
      allowedSlots: ['weapon'],
      itemName: 'Sword',
      damageRoll: '1d6',
      computedBonuses: {
        weaponDamageRoll: '1d6',
      },
    });
  });

  it('handles equip/unequip flows including AppErrors', async () => {
    playerService.getPlayer.mockResolvedValue({ id: 1 } as never);

    playerItemService.equip.mockResolvedValue({ id: 21 });
    const equip = await controller.equip({
      teamId: 'T1',
      userId: 'U1',
      playerItemId: 21,
      slot: 'weapon',
    });
    expect(runsService.ensurePlayerNotInRun).toHaveBeenCalledWith(
      1,
      'Finish your raid before changing equipment.',
    );
    expect(
      playerService.recalculatePlayerHitPointsFromEquipment,
    ).toHaveBeenCalledWith(1);
    expect(equip.success).toBe(true);

    playerItemService.unequip.mockResolvedValue({ id: 31 });
    const unequip = await controller.unequip({
      teamId: 'T1',
      userId: 'U1',
      playerItemId: 31,
    });
    expect(runsService.ensurePlayerNotInRun).toHaveBeenCalledWith(
      1,
      'Finish your raid before changing equipment.',
    );
    expect(unequip.success).toBe(true);

    const err = new AppError(ErrCodes.NOT_OWNED, 'not yours');
    playerItemService.equip.mockRejectedValue(err);
    const equipError = await controller.equip({
      teamId: 'T1',
      userId: 'U1',
      playerItemId: 21,
      slot: 'weapon',
    });
    expect(equipError).toEqual({
      success: false,
      message: 'not yours',
      code: ErrCodes.NOT_OWNED,
    });
  });

  it('validates equip payloads before hitting services', async () => {
    expect(
      await controller.equip({
        teamId: 'T1',
        userId: 'U1',
        slot: 'invalid',
        playerItemId: 1,
      } as never),
    ).toEqual({ success: false, message: 'Invalid slot' });
  });
});
