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
      slackUser: { teamId: 'T1', userId: 'U1' },
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
      respawnPlayer: jest.fn(),
      restorePlayerHealth: jest.fn().mockResolvedValue({
        combat: { maxHp: 20, hp: 20 },
        level: 2,
        isAlive: true,
      }),
    };

    const prisma: any = {
      combatLog: { create: jest.fn().mockResolvedValue({}) },
      monster: {
        delete: jest.fn().mockResolvedValue({
          id: 99,
          name: 'Goblin',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 99,
          name: 'Goblin',
        }),
        update: jest.fn().mockResolvedValue(undefined),
      },
      player: {
        findFirst: jest.fn().mockResolvedValue({
          slackUser: { teamId: 'T1', userId: 'U1' },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
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

    expect(playerService.getPlayer).toHaveBeenCalledWith('T1', 'U1', {
      requireCreationComplete: true,
    });
    expect(playerService.updatePlayerStats).toHaveBeenCalledWith(
      'T1',
      'U1',
      expect.objectContaining({
        xp: 110,
        gold: 8,
      }),
    );
    expect(playerService.restorePlayerHealth).toHaveBeenCalledWith('T1', 'U1');
    expect(prisma.monster.delete).toHaveBeenCalledWith({
      where: { id: 99 },
    });
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
      slackUser: { teamId: 'T1', userId: 'U1' },
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
      slackUser: { teamId: 'T2', userId: 'U2' },
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
        id: 2,
        name: 'Other',
        hp: 10,
        maxHp: 10,
        isAlive: true,
      }),
      restorePlayerHealth: jest.fn().mockResolvedValue({
        combat: { maxHp: 8, hp: 8, isAlive: true },
        level: 1,
        isAlive: true,
      }),
    };

    const prisma: any = {
      combatLog: { create: jest.fn().mockResolvedValue({}) },
      player: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce({
            id: 2,
            slackUser: { teamId: 'T2', userId: 'U2' },
          })
          .mockResolvedValueOnce({
            id: 1,
            slackUser: { teamId: 'T1', userId: 'U1' },
          }),
      },
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

    expect(playerService.respawnPlayer).toHaveBeenCalledWith('T2', 'U2');
    expect(playerService.restorePlayerHealth).toHaveBeenCalledWith('T1', 'U1');
    expect(playerService.getPlayer).toHaveBeenCalledWith('T1', 'U1', {
      requireCreationComplete: true,
    });
    expect(prisma.combatLog.create).toHaveBeenCalled();
  });
});
