jest.mock('@mud/database', () => ({
  Player: class {},
  Monster: class {},
  getPrismaClient: jest.fn(),
}));

import { PlayerResolver } from './player.resolver';
import { TargetType } from '../inputs/player.input';

describe('PlayerResolver', () => {
  const basePlayer = {
    id: 1,
    slackId: 'U1',
    name: 'Hero',
    x: 0,
    y: 0,
    strength: 12,
    agility: 14,
    health: 13,
    level: 2,
    xp: 150,
    hp: 10,
    maxHp: 12,
    isAlive: true,
  };

  const createResolver = () => {
    const playerService = {
      createPlayer: jest.fn().mockResolvedValue(basePlayer),
      getPlayerByIdentifier: jest
        .fn()
        .mockResolvedValue({ ...basePlayer, id: 42 }),
      getAllPlayers: jest.fn().mockResolvedValue([basePlayer, { ...basePlayer, id: 2, slackId: 'U2', name: 'Villain' }]),
      updatePlayerStats: jest.fn().mockResolvedValue(basePlayer),
      rerollPlayerStats: jest.fn().mockResolvedValue(basePlayer),
      healPlayer: jest.fn().mockResolvedValue({ ...basePlayer, hp: 12 }),
      damagePlayer: jest.fn().mockResolvedValue({ ...basePlayer, hp: 3 }),
      respawnPlayer: jest.fn().mockResolvedValue({ ...basePlayer, hp: 12, x: 10, y: -10 }),
      deletePlayer: jest.fn().mockResolvedValue(basePlayer),
      getPlayersAtLocation: jest.fn().mockResolvedValue([basePlayer]),
      getPlayer: jest.fn().mockResolvedValue(basePlayer),
      rerollPlayerStats: jest.fn().mockResolvedValue(basePlayer),
    } as any;

    const monsterService = {
      getMonstersAtLocation: jest.fn().mockResolvedValue([{ id: 1 }]),
    } as any;

    const combatService = {
      playerAttackMonster: jest.fn().mockResolvedValue({ result: 'monster defeated' }),
      playerAttackPlayer: jest.fn().mockResolvedValue({ result: 'player defeated' }),
      getCombatLogForLocation: jest.fn().mockResolvedValue([{ id: 'log' }]),
    } as any;

    const worldService = {
      getTileInfo: jest.fn().mockResolvedValue({
        x: 0,
        y: 0,
        biomeName: 'forest',
        description: 'lush',
        height: 0.5,
        temperature: 0.4,
        moisture: 0.6,
      }),
    } as any;

    const resolver = new PlayerResolver(
      playerService,
      monsterService,
      combatService,
      worldService,
    );

    return { resolver, playerService, combatService, monsterService, worldService };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a player', async () => {
    const { resolver, playerService } = createResolver();
    const result = await resolver.createPlayer({ slackId: 'U1', name: 'Hero' } as any);
    expect(result.success).toBe(true);
    expect(playerService.createPlayer).toHaveBeenCalled();
  });

  it('gets a player by identifier and handles missing input', async () => {
    const { resolver, playerService } = createResolver();
    const success = await resolver.getPlayer('U1', undefined);
    expect(success.success).toBe(true);

    const missing = await resolver.getPlayer(undefined, undefined);
    expect(missing.success).toBe(false);

    playerService.getPlayerByIdentifier.mockRejectedValueOnce(new Error('no player'));
    const failure = await resolver.getPlayer('U1', undefined);
    expect(failure.success).toBe(false);
  });

  it('updates and rerolls and heals players', async () => {
    const { resolver, playerService } = createResolver();
    const stats = await resolver.updatePlayerStats('U1', { hp: 5 } as any);
    expect(stats.success).toBe(true);

    playerService.updatePlayerStats.mockRejectedValueOnce(new Error('boom'));
    const statsFailure = await resolver.updatePlayerStats('U1', { hp: 5 } as any);
    expect(statsFailure.success).toBe(false);

    const reroll = await resolver.rerollPlayerStats('U1');
    expect(reroll.success).toBe(true);

    playerService.rerollPlayerStats.mockRejectedValueOnce(new Error('no reroll'));
    const rerollFail = await resolver.rerollPlayerStats('U1');
    expect(rerollFail.success).toBe(false);

    const healed = await resolver.healPlayer('U1', 5);
    expect(healed.data?.hp).toBe(12);

    playerService.healPlayer.mockRejectedValueOnce(new Error('fail'));
    const healFail = await resolver.healPlayer('U1', 1);
    expect(healFail.success).toBe(false);

    const damaged = await resolver.damagePlayer('U1', 7);
    expect(damaged.data?.hp).toBe(3);

    playerService.damagePlayer.mockRejectedValueOnce(new Error('hurt'));
    const damageFail = await resolver.damagePlayer('U1', 1);
    expect(damageFail.success).toBe(false);
  });

  it('handles attacks against monsters and players', async () => {
    const { resolver, combatService, playerService } = createResolver();

    const vsMonster = await resolver.attack('U1', {
      targetType: TargetType.MONSTER,
      targetId: 10,
    } as any);
    expect(vsMonster.success).toBe(true);
    expect(combatService.playerAttackMonster).toHaveBeenCalledWith('U1', 10);

    const vsPlayerSlack = await resolver.attack('U1', {
      targetType: TargetType.PLAYER,
      targetSlackId: 'U2',
      ignoreLocation: true,
    } as any);
    expect(vsPlayerSlack.success).toBe(true);
    expect(combatService.playerAttackPlayer).toHaveBeenCalledWith('U1', 'U2', true);

    const vsPlayerById = await resolver.attack('U1', {
      targetType: TargetType.PLAYER,
      targetId: 2,
    } as any);
    expect(vsPlayerById.success).toBe(true);

    await expect(
      resolver.attack('U1', {
        targetType: TargetType.PLAYER,
        targetId: undefined,
      } as any),
    ).resolves.toHaveProperty('success', false);

    playerService.getAllPlayers.mockResolvedValueOnce([basePlayer]);
    const missingTarget = await resolver.attack('U1', {
      targetType: TargetType.PLAYER,
      targetId: 999,
    } as any);
    expect(missingTarget.success).toBe(false);

    combatService.playerAttackMonster.mockRejectedValueOnce(new Error('ouch'));
    const failedAttack = await resolver.attack('U1', {
      targetType: TargetType.MONSTER,
      targetId: 1,
    } as any);
    expect(failedAttack.success).toBe(false);
  });

  it('respawns and deletes player', async () => {
    const { resolver, playerService } = createResolver();
    const respawn = await resolver.respawn('U1');
    expect(respawn.success).toBe(true);

    playerService.respawnPlayer.mockRejectedValueOnce(new Error('no respawn'));
    const respawnFail = await resolver.respawn('U1');
    expect(respawnFail.success).toBe(false);

    const deleted = await resolver.deletePlayer('U1');
    expect(deleted.success).toBe(true);

    playerService.deletePlayer.mockRejectedValueOnce(new Error('delete fail'));
    const deleteFail = await resolver.deletePlayer('U1');
    expect(deleteFail.success).toBe(false);
  });

  it('computes player stats and field resolvers', async () => {
    const { resolver, playerService, monsterService, worldService } = createResolver();
    const stats = await resolver.getPlayerStats('U1', undefined);
    expect(stats.baseDamage).toContain('1d6');
    expect(playerService.getPlayerByIdentifier).toHaveBeenCalled();

    const tile = await resolver.currentTile(basePlayer as any);
    expect(tile?.biomeName).toBe('forest');
    worldService.getTileInfo.mockRejectedValueOnce(new Error('missing tile'));
    const missingTile = await resolver.currentTile(basePlayer as any);
    expect(missingTile).toBeNull();

    const nearby = await resolver.nearbyPlayers(basePlayer as any);
    expect(Array.isArray(nearby)).toBe(true);

    playerService.getPlayersAtLocation.mockRejectedValueOnce(new Error('no players'));
    const fallback = await resolver.nearbyPlayers(basePlayer as any);
    expect(fallback).toEqual([]);

    const monsters = await resolver.nearbyMonsters(basePlayer as any);
    expect(monsters.length).toBeGreaterThan(0);

    monsterService.getMonstersAtLocation.mockRejectedValueOnce(new Error('none'));
    const noMonsters = await resolver.nearbyMonsters(basePlayer as any);
    expect(noMonsters).toEqual([]);
  });
});
