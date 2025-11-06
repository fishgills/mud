jest.mock('@mud/engine', () => ({
  MonsterFactory: {
    load: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  },
}));

import { applyCombatResults } from './results';
import { MonsterFactory } from '@mud/engine';
import { AttackOrigin } from '../api/dto/player-requests.dto';

describe('applyCombatResults', () => {
  afterEach(() => jest.resetAllMocks());

  test('player winner vs monster (monster alive) updates monster entity and awards XP/gold to player', async () => {
    const combatLog: any = {
      combatId: 'c1',
      winner: 'Hero',
      loser: 'Goblin',
      xpAwarded: 10,
      goldAwarded: 3,
      rounds: [{ damage: 5 }],
      location: { x: 0, y: 0 },
    };

    const playerWinner: any = {
      id: 1,
      name: 'Hero',
      type: 'player',
      hp: 10,
      maxHp: 10,
      strength: 12,
      agility: 12,
      level: 2,
      isAlive: true,
      x: 0,
      y: 0,
      slackId: 'S1',
    };

    const monsterLoser: any = {
      id: 99,
      name: 'Goblin',
      type: 'monster',
      hp: 0,
      maxHp: 8,
      strength: 6,
      agility: 8,
      level: 1,
      isAlive: false,
      x: 0,
      y: 0,
    };

    const playerService: any = {
      getPlayer: jest.fn().mockResolvedValue({
        xp: 100,
        gold: 5,
        level: 2,
        skillPoints: 0,
        combat: { maxHp: 20, hp: 10 },
      }),
      updatePlayerStats: jest.fn().mockResolvedValue({
        level: 2,
        skillPoints: 0,
        combat: { maxHp: 20, hp: 10 },
      }),
      respawnPlayer: jest.fn().mockResolvedValue({ player: null, event: null }),
      restorePlayerHealth: jest.fn().mockResolvedValue({
        combat: { maxHp: 20, hp: 20 },
        level: 2,
        position: { x: 0, y: 0 },
      }),
    };

    const prisma: any = {
      combatLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const logger: any = { debug: jest.fn(), log: jest.fn() };

    // MonsterFactory.delete should be called because monster is dead
    (MonsterFactory.delete as jest.Mock).mockResolvedValue(true);

    await applyCombatResults(
      combatLog,
      playerWinner,
      monsterLoser,
      playerService,
      prisma,
      logger,
      { attackOrigin: AttackOrigin.TEXT_PVE },
    );

    expect(playerService.getPlayer).toHaveBeenCalledWith('S1');
    expect(playerService.updatePlayerStats).toHaveBeenCalledWith('S1', {
      xp: 110,
      gold: 8,
    });
    expect(playerService.restorePlayerHealth).toHaveBeenCalledWith('S1');
    expect(MonsterFactory.delete).toHaveBeenCalledWith(99, expect.any(Object));
    expect(prisma.combatLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Object) }),
    );
  });

  test('player winner vs player loser (dead) updates loser and respawns', async () => {
    const combatLog: any = {
      combatId: 'c2',
      winner: 'Hero',
      loser: 'Other',
      xpAwarded: 5,
      goldAwarded: 0,
      rounds: [{ damage: 3 }],
      location: { x: 1, y: 1 },
    };

    const playerWinner: any = {
      id: 1,
      name: 'Hero',
      type: 'player',
      hp: 8,
      maxHp: 10,
      strength: 12,
      agility: 12,
      level: 1,
      isAlive: true,
      x: 1,
      y: 1,
      slackId: 'S1',
    };

    const playerLoser: any = {
      id: 2,
      name: 'Other',
      type: 'player',
      hp: 0,
      maxHp: 10,
      strength: 10,
      agility: 10,
      level: 1,
      isAlive: false,
      x: 1,
      y: 1,
      slackId: 'S2',
    };

    const playerService: any = {
      getPlayer: jest.fn().mockResolvedValue({
        xp: 0,
        gold: 0,
        level: 1,
        skillPoints: 0,
        combat: { maxHp: 10, hp: 0 },
      }),
      updatePlayerStats: jest.fn().mockResolvedValue({
        level: 1,
        skillPoints: 0,
        combat: { maxHp: 10, hp: 10 },
      }),
      respawnPlayer: jest.fn().mockResolvedValue({
        player: {
          id: 2,
          name: 'Other',
          combat: { hp: 10, maxHp: 10, isAlive: true },
          position: { x: 5, y: 5 },
        },
        event: {
          eventType: 'player:respawn',
        },
      }),
      restorePlayerHealth: jest.fn().mockResolvedValue({
        combat: { maxHp: 8, hp: 8, isAlive: true },
        level: 1,
        position: { x: 1, y: 1 },
      }),
    };

    const prisma: any = {
      combatLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const logger: any = { debug: jest.fn(), log: jest.fn() };

    await applyCombatResults(
      combatLog,
      playerWinner,
      playerLoser,
      playerService,
      prisma,
      logger,
      { attackOrigin: AttackOrigin.DROPDOWN_PVP },
    );

    expect(playerService.respawnPlayer).toHaveBeenCalledWith('S2', {
      emitEvent: false,
    });
    expect(playerService.restorePlayerHealth).toHaveBeenCalledWith('S1');
    expect(playerService.getPlayer).toHaveBeenCalledWith('S1');
    expect(prisma.combatLog.create).toHaveBeenCalled();
  });
});
