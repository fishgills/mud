import { CombatService } from './combat.service';
import { PlayerService } from '../player/player.service';
import { AiService } from '../../openai/ai.service';


type MockPlayerService = Pick<
  PlayerService,
  'getPlayer' | 'updatePlayerStats' | 'respawnPlayer'
>;

type MockAiService = Pick<AiService, 'getText'>;

describe('CombatService', () => {
  let service: CombatService;
  let playerService: jest.Mocked<MockPlayerService>;
  let aiService: jest.Mocked<MockAiService>;

  beforeEach(() => {
    playerService = {
      getPlayer: jest.fn(),
      updatePlayerStats: jest.fn(),
      respawnPlayer: jest.fn(),
    } as jest.Mocked<MockPlayerService>;

    aiService = {
      getText: jest.fn(),
    } as jest.Mocked<MockAiService>;

    service = new CombatService(
      playerService as unknown as PlayerService,
      aiService as unknown as AiService,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves player vs player combat with deterministic rolls', async () => {
    const attackerPlayer = {
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 12,
      maxHp: 12,
      strength: 16,
      agility: 12,
      level: 3,
      isAlive: true,
      x: 5,
      y: 5,
    } as any;

    const defenderPlayer = {
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      hp: 8,
      maxHp: 8,
      strength: 10,
      agility: 10,
      level: 2,
      isAlive: true,
      x: 5,
      y: 5,
    } as any;

    playerService.getPlayer.mockImplementation(async (slackId) => {
      if (slackId === 'attacker') {
        return attackerPlayer;
      }
      return defenderPlayer;
    });

    const narrativeSpy = jest
      .spyOn<any, any>(service as any, 'generateCombatNarrative')
      .mockImplementation(async (_combatLog, options) =>
        options?.secondPersonName === 'Attacker'
          ? 'Attacker POV summary'
          : 'Defender POV summary',
      );
    const applyResultsSpy = jest
      .spyOn<any, any>(service as any, 'applyCombatResults')
      .mockResolvedValue(undefined);
    const initiativeSpy = jest
      .spyOn<any, any>(service as any, 'rollInitiative')
      .mockImplementationOnce(() => ({ roll: 15, modifier: 2, total: 17 }))
      .mockImplementationOnce(() => ({ roll: 5, modifier: 0, total: 5 }));
    const attackRollSpy = jest
      .spyOn<any, any>(service as any, 'rollD20')
      .mockReturnValue(12);
    const damageSpy = jest
      .spyOn<any, any>(service as any, 'calculateDamage')
      .mockReturnValue(9);
    const xpSpy = jest
      .spyOn<any, any>(service as any, 'calculateXpGain')
      .mockReturnValue(120);
    const goldSpy = jest
      .spyOn<any, any>(service as any, 'calculateGoldReward')
      .mockReturnValue(45);

    const result = await service.playerAttackPlayer('attacker', 'defender');

    expect(result.success).toBe(true);
    expect(result.winnerName).toBe('Attacker');
    expect(result.loserName).toBe('Defender');
    expect(result.xpGained).toBe(120);
    expect(result.goldGained).toBe(45);
    expect(result.roundsCompleted).toBe(1);
    expect(result.totalDamageDealt).toBe(9);
    expect(result.message).toBe('Attacker POV summary');
    expect(result.playerMessages).toHaveLength(2);
    expect(result.playerMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slackId: 'attacker',
          name: 'Attacker',
          message: 'Attacker POV summary',
        }),
        expect.objectContaining({
          slackId: 'defender',
          name: 'Defender',
          message: 'Defender POV summary',
        }),
      ]),
    );

    expect(result.combatLog.winner).toBe('Attacker');
    expect(result.combatLog.loser).toBe('Defender');
    expect(result.combatLog.firstAttacker).toBe('Attacker');
    expect(result.combatLog.xpAwarded).toBe(120);
    expect(result.combatLog.goldAwarded).toBe(45);
    expect(result.combatLog.rounds).toHaveLength(1);

    const [firstRound] = result.combatLog.rounds;
    expect(firstRound).toMatchObject({
      attackerName: 'Attacker',
      defenderName: 'Defender',
      hit: true,
      damage: 9,
      defenderHpAfter: 0,
      killed: true,
    });

    expect(playerService.getPlayer).toHaveBeenCalledTimes(2);
    expect(initiativeSpy).toHaveBeenCalledTimes(2);
    expect(attackRollSpy).toHaveBeenCalledTimes(1);
    expect(damageSpy).toHaveBeenCalledTimes(1);
    expect(xpSpy).toHaveBeenCalledWith(defenderPlayer.level, attackerPlayer.level);
    expect(goldSpy).toHaveBeenCalledWith(attackerPlayer.level, defenderPlayer.level);
    expect(applyResultsSpy).toHaveBeenCalledWith(
      expect.objectContaining({ winner: 'Attacker', loser: 'Defender' }),
      expect.objectContaining({ name: 'Attacker' }),
      expect.objectContaining({ name: 'Defender' }),
    );
    expect(narrativeSpy).toHaveBeenNthCalledWith(1, result.combatLog, {
      secondPersonName: 'Attacker',
    });
    expect(narrativeSpy).toHaveBeenNthCalledWith(2, result.combatLog, {
      secondPersonName: 'Defender',
    });
  });

  it('throws when players are in different locations', async () => {
    const attackerPlayer = {
      id: 1,
      name: 'Attacker',
      slackId: 'attacker',
      hp: 10,
      maxHp: 10,
      strength: 12,
      agility: 12,
      level: 2,
      isAlive: true,
      x: 1,
      y: 1,
    } as any;

    const defenderPlayer = {
      id: 2,
      name: 'Defender',
      slackId: 'defender',
      hp: 10,
      maxHp: 10,
      strength: 12,
      agility: 12,
      level: 2,
      isAlive: true,
      x: 2,
      y: 3,
    } as any;

    playerService.getPlayer.mockImplementation(async (slackId) => {
      if (slackId === 'attacker') {
        return attackerPlayer;
      }
      return defenderPlayer;
    });

    await expect(
      service.playerAttackPlayer('attacker', 'defender'),
    ).rejects.toThrow('Defender is not at your location');
  });
});
