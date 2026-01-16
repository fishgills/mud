import { CombatMessenger } from './messages';
import type { DetailedCombatLog } from '../api';

const makeCombatLog = (): DetailedCombatLog => ({
  combatId: 'test',
  participant1: 'Hero',
  participant2: 'Goblin',
  firstAttacker: 'Hero',
  initiativeRolls: [],
  rounds: [
    {
      roundNumber: 1,
      attackerName: 'Hero',
      defenderName: 'Goblin',
      attackRating: 60,
      defenseRating: 40,
      hitChance: 0.72,
      hitRoll: 0.12,
      hit: true,
      weaponDamage: 3,
      coreDamage: 12,
      baseDamage: 15,
      mitigation: 0.2,
      damageAfterMitigation: 12,
      critChance: 0.05,
      critRoll: 0.99,
      critMultiplier: 1.5,
      crit: false,
      damage: 12,
      defenderHpAfter: 0,
      killed: true,
    },
  ],
  winner: 'Hero',
  loser: 'Goblin',
  xpAwarded: 12,
  goldAwarded: 4,
  timestamp: new Date(),
});

describe('CombatMessenger', () => {
  const createMessenger = () => {
    const aiService = { getText: jest.fn() } as any;
    const logger = { debug: jest.fn(), log: jest.fn() } as any;
    const messenger = new CombatMessenger(aiService, logger);
    return { messenger, aiService };
  };

  test('generateCombatNarrative produces deterministic math-focused output', async () => {
    const { messenger, aiService } = createMessenger();
    const log = makeCombatLog();
    const attacker = {
      id: 1,
      name: 'Hero',
      type: 'player',
      hp: 12,
      maxHp: 12,
      strength: 14,
      agility: 12,
      health: 11,
      level: 5,
      isAlive: true,
      damageRoll: '1d8',
      equippedItems: [
        { name: 'Fine Longsword', slot: 'weapon', quality: 'Fine' },
      ],
    } as any;
    const defender = {
      id: 2,
      name: 'Goblin',
      type: 'monster',
      hp: 8,
      maxHp: 8,
      strength: 10,
      agility: 11,
      health: 9,
      level: 2,
      isAlive: true,
    } as any;

    const narrative = await messenger.generateCombatNarrative(log, {
      attackerCombatant: attacker,
      defenderCombatant: defender,
    });

    expect(aiService.getText).not.toHaveBeenCalled();
    expect(narrative).toContain(
      'Hero (Lvl 5, HP 12/12, Str 14, Agi 12, Vit 11, Weapon 1d8, Gear: Fine Longsword [Fine]) vs Goblin (Lvl 2, HP 8/8, Str 10, Agi 11, Vit 9, Gear: none)',
    );
    expect(narrative).toContain('Round 1');
    expect(narrative).toContain('Hero strike: AR');
    expect(narrative).toContain("AR math: 10*S'");
    expect(narrative).toContain('-> HIT');
    expect(narrative).toContain('Damage:');
    expect(narrative).toContain('Goblin HP 0/8 KO');
  });

  test('buildParticipantMessage includes rewards and level-up text when present', async () => {
    const { messenger, aiService } = createMessenger();
    aiService.getText.mockResolvedValue({ output_text: 'Short summary' });

    const log = makeCombatLog();
    const participant = {
      id: 1,
      name: 'Hero',
      type: 'player',
      slackUser: { teamId: 'T1', userId: 'U1' },
      hp: 10,
      maxHp: 10,
      strength: 12,
      agility: 12,
      health: 10,
      level: 4,
      isAlive: true,
      levelUp: { previousLevel: 3, newLevel: 4, skillPointsAwarded: 1 },
    } as any;
    const defender = {
      id: 2,
      name: 'Goblin',
      type: 'monster',
      hp: 8,
      maxHp: 8,
      strength: 10,
      agility: 11,
      health: 9,
      level: 2,
      isAlive: true,
    } as any;

    const msg = await messenger.buildParticipantMessage(
      log,
      participant,
      'attacker',
      { attacker: participant, defender },
    );

    expect(msg).not.toBeNull();
    expect(msg!.message).toContain('Rewards: +12 XP, +4 gold.');
    expect(msg!.message).toContain('🎉 Level up');
    expect(Array.isArray(msg!.blocks)).toBe(true);
  });

  test('generateEntertainingSummary returns AI text and falls back when empty', async () => {
    const { messenger, aiService } = createMessenger();
    aiService.getText.mockResolvedValue({ output_text: 'Nice summary' });

    const log = makeCombatLog();
    const summary = await messenger.generateEntertainingSummary(log, {});
    expect(summary).toBe('Nice summary');

    aiService.getText.mockResolvedValueOnce({ output_text: '' });
    const fallback = await messenger.generateEntertainingSummary(log, {});
    expect(fallback).toContain('defeats');
  });

  test('buildParticipantMessage returns null for non-player or missing slackId', async () => {
    const { messenger } = createMessenger();
    const log = makeCombatLog();
    const context = {
      attacker: {
        type: 'player',
        name: 'Hero',
        hp: 10,
        maxHp: 10,
        slackUser: { teamId: 'T1', userId: 'U1' },
      } as any,
      defender: {
        type: 'monster',
        name: 'Goblin',
        hp: 8,
        maxHp: 8,
      } as any,
    };

    const nonPlayer = {
      type: 'monster',
      slackUser: { teamId: 'T2', userId: 'U2' },
    } as any;
    expect(
      await messenger.buildParticipantMessage(
        log,
        nonPlayer,
        'attacker',
        context,
      ),
    ).toBeNull();

    const missingSlack = { type: 'player', slackUser: undefined } as any;
    expect(
      await messenger.buildParticipantMessage(
        log,
        missingSlack,
        'defender',
        context,
      ),
    ).toBeNull();
  });

  test('generateCombatMessages returns participant messages only', async () => {
    const { messenger, aiService } = createMessenger();
    aiService.getText.mockResolvedValue({ output_text: 'S' });

    const log = makeCombatLog();
    const attacker = {
      id: 1,
      name: 'Hero',
      type: 'player',
      slackUser: { teamId: 'T-A', userId: 'U-A' },
      hp: 12,
      maxHp: 12,
      strength: 14,
      agility: 12,
      health: 11,
      level: 5,
      isAlive: true,
    } as any;
    const defender = {
      id: 2,
      name: 'Defender',
      type: 'player',
      slackUser: { teamId: 'T-B', userId: 'U-B' },
      hp: 11,
      maxHp: 11,
      strength: 11,
      agility: 11,
      health: 10,
      level: 4,
      isAlive: true,
    } as any;

    const res = await messenger.generateCombatMessages(log, attacker, defender);
    expect(res.messages.every((m) => m.role !== 'observer')).toBe(true);
  });
});
