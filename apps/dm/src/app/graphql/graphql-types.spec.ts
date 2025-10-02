import {
  LocationInfo,
  TickResult,
  SuccessResponse,
  PlayerResponse,
  LocationResponse,
  MonsterResponse,
  CombatRound,
  InitiativeRoll,
  CombatLocation,
  DetailedCombatLog,
  CombatResponse,
  PlayerMoveResponse,
  LookViewResponse,
  CombatResult,
  LookViewData,
  PerformanceStats,
  NearbyPlayerInfo,
} from './types/response.types';
import { Player } from './models/player.model';
import { Monster } from './models/monster.model';
import { TileInfo } from './models/tile-info.model';
import { CombatLog } from './models/combat-log.model';

describe('GraphQL response and model classes', () => {
  it('instantiates and assigns fields', () => {
    const locationInfo = new LocationInfo();
    locationInfo.location = Object.assign(new TileInfo(), {
      x: 1,
      y: 2,
      biomeName: 'forest',
      description: 'lush',
      height: 0.8,
      temperature: 0.5,
      moisture: 0.6,
    });
    locationInfo.monsters = [Object.assign(new Monster(), { name: 'Goblin' })];
    locationInfo.players = [Object.assign(new Player(), { name: 'Hero' })];
    locationInfo.recentCombat = [Object.assign(new CombatLog(), { id: '1' })];
    locationInfo.x = 1;
    locationInfo.y = 2;

    const tickResult = Object.assign(new TickResult(), {
      tick: 1,
      gameHour: 2,
      gameDay: 3,
      monstersSpawned: 4,
      monstersMoved: 5,
      combatEvents: 6,
      weatherUpdated: true,
    });

    const success = Object.assign(new SuccessResponse(), {
      success: true,
      message: 'ok',
      result: tickResult,
    });

    const playerResponse = Object.assign(new PlayerResponse(), {
      success: true,
      data: Object.assign(new Player(), { name: 'Hero' }),
    });

    const locationResponse = Object.assign(new LocationResponse(), {
      success: true,
      data: locationInfo,
    });

    const monsterResponse = Object.assign(new MonsterResponse(), {
      success: true,
      data: Object.assign(new Monster(), { name: 'Goblin' }),
    });

    const combatRound = Object.assign(new CombatRound(), {
      roundNumber: 1,
      attackerName: 'Hero',
      defenderName: 'Goblin',
      attackRoll: 15,
      attackModifier: 3,
      totalAttack: 18,
      defenderAC: 12,
      hit: true,
      damage: 5,
      defenderHpAfter: 0,
      killed: true,
    });

    const initiative = Object.assign(new InitiativeRoll(), {
      name: 'Hero',
      roll: 12,
      modifier: 3,
      total: 15,
    });

    const combatLocation = Object.assign(new CombatLocation(), { x: 1, y: 2 });

    const detailedLog = Object.assign(new DetailedCombatLog(), {
      combatId: 'abc',
      participant1: 'Hero',
      participant2: 'Goblin',
      initiativeRolls: [initiative],
      firstAttacker: 'Hero',
      rounds: [combatRound],
      summary: 'summary',
      location: combatLocation,
      winner: 'Hero',
      loser: 'Goblin',
      xpAwarded: 12,
      totalDamageDealt: 5,
    });

    const combatResult = Object.assign(new CombatResult(), {
      summary: 'result',
      rounds: [combatRound],
      initiative: [initiative],
      location: combatLocation,
      rewards: { xp: 10, gold: 5 },
    });

    const combatResponse = Object.assign(new CombatResponse(), {
      success: true,
      data: combatResult,
    });

    const moveResponse = Object.assign(new PlayerMoveResponse(), {
      success: true,
      player: playerResponse.data,
      monsters: monsterResponse.data ? [monsterResponse.data] : [],
      playersAtLocation: [playerResponse.data],
      message: 'moved',
    });

    const lookViewResponse = Object.assign(new LookViewResponse(), {
      success: true,
      data: Object.assign(new LookViewData(), {
        location: locationInfo.location,
        nearbyPlayers: [
          Object.assign(new NearbyPlayerInfo(), {
            slackId: 'U123',
            name: 'Friend',
            distance: 2,
            direction: 'north',
          }),
        ],
        visibilityRadius: 5,
        biomeSummary: [],
        visiblePeaks: [],
        visibleSettlements: [],
        monsters: [],
        currentSettlement: undefined,
        inSettlement: false,
        description: 'desc',
      }),
      perf: Object.assign(new PerformanceStats(), {
        totalMs: 1,
        playerMs: 1,
        worldCenterNearbyMs: 1,
        worldBoundsTilesMs: 1,
        worldExtendedBoundsMs: 1,
        tilesFilterMs: 1,
        peaksSortMs: 1,
        biomeSummaryMs: 1,
        settlementsFilterMs: 1,
        aiMs: 1,
        tilesCount: 1,
        peaksCount: 1,
        aiProvider: 'openai',
      }),
    });

    expect(success.success).toBe(true);
    expect(playerResponse.data?.name).toBe('Hero');
    expect(locationResponse.data?.location.x).toBe(1);
    expect(monsterResponse.data?.name).toBe('Goblin');
    expect(detailedLog.rounds[0].hit).toBe(true);
    expect(combatResponse.success).toBe(true);
    expect(moveResponse.player?.name).toBe('Hero');
    expect(lookViewResponse.perf?.aiProvider).toBe('openai');
  });
});
