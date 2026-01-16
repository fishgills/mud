import * as engine from './engine';
import { runCombat, runTeamCombat } from './engine';
import type { Combatant } from './types';

describe('combat engine utilities', () => {
  test('effective stats and ratings follow combat formulas', () => {
    const effective = {
      strength: engine.effectiveStat(16),
      agility: engine.effectiveStat(9),
      health: engine.effectiveStat(25),
      level: engine.effectiveStat(4),
    };

    expect(effective.strength).toBe(4);
    expect(effective.agility).toBe(3);
    expect(effective.health).toBe(5);
    expect(effective.level).toBe(2);

    const attackRating = engine.calculateAttackRating(effective);
    const defenseRating = engine.calculateDefenseRating(effective);
    expect(attackRating).toBe(64);
    expect(defenseRating).toBe(52);

    const hitChance = engine.calculateHitChance(attackRating, defenseRating);
    expect(hitChance).toBeCloseTo(0.69, 2);
    expect(engine.calculateHitChance(0, 1000)).toBe(0.1);
    expect(engine.calculateHitChance(1000, 0)).toBe(0.9);
  });

  test('calculateXpGain and calculateGoldReward are deterministic when Math.random is mocked', () => {
    const mr = jest.spyOn(Math, 'random');
    mr.mockReturnValueOnce(0).mockReturnValueOnce(0.9999);
    const xp = engine.calculateXpGain(3, 4);
    expect(xp).toBe(54);

    mr.mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5);
    const gold = engine.calculateGoldReward(3, 4);
    expect(gold).toBe(Math.max(5, Math.floor(20 * 1.1)));

    mr.mockRestore();
  });
});

describe('runCombat orchestration with overrides', () => {
  const makeCombatant = (
    opts: Partial<Combatant> & { name: string; id: number },
  ): Combatant => ({
    id: opts.id,
    name: opts.name,
    type: (opts.type as any) || 'player',
    hp: opts.hp ?? 10,
    maxHp: opts.maxHp ?? 10,
    strength: opts.strength ?? 12,
    agility: opts.agility ?? 12,
    health: opts.health ?? 12,
    level: opts.level ?? 1,
    isAlive: opts.isAlive ?? true,
    damageRoll: opts.damageRoll,
  });

  test('attacker wins and xp/gold from overrides are applied to returned log', async () => {
    const attacker = makeCombatant({
      name: 'Hero',
      id: 1,
      hp: 12,
      strength: 16,
      agility: 20,
      health: 12,
      level: 3,
      damageRoll: '1d4',
    });
    const defender = makeCombatant({
      name: 'Goblin',
      id: 2,
      hp: 3,
      maxHp: 3,
      strength: 8,
      agility: 5,
      health: 8,
      level: 2,
    });

    const logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    const randomQueue = [0, 0, 0.01, 0.99];
    const overrides = {
      rollRandom: () => randomQueue.shift() ?? 0,
      rollDice: () => 4,
      calculateXpGain: () => 12,
      calculateGoldReward: () => 4,
    } as const;

    const result = await runCombat(
      attacker,
      defender,
      logger,
      overrides as any,
    );

    expect(result.winner).toBe('Hero');
    expect(result.loser).toBe('Goblin');
    expect(result.xpAwarded).toBe(12);
    expect(result.goldAwarded).toBe(4);
    expect(result.rounds.length).toBeGreaterThanOrEqual(1);
    expect(result.firstAttacker).toBe('Hero');
  });

  test('computes ratings, mitigation, and weapon damage', async () => {
    const attacker = makeCombatant({
      name: 'Champion',
      id: 10,
      strength: 16,
      agility: 9,
      health: 9,
      level: 4,
      damageRoll: '1d4',
      hp: 20,
      maxHp: 20,
    });

    const defender = makeCombatant({
      name: 'Guardian',
      id: 20,
      strength: 10,
      agility: 9,
      health: 16,
      level: 4,
      hp: 30,
      maxHp: 30,
    });

    const logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    const randomQueue = [0, 0, 0.01, 0.99];
    const overrides = {
      rollRandom: () => randomQueue.shift() ?? 0,
      rollDice: () => 4,
      calculateXpGain: () => 0,
      calculateGoldReward: () => 0,
    } as const;

    const result = await runCombat(
      attacker,
      defender,
      logger,
      overrides as any,
    );

    const [firstRound] = result.rounds;
    expect(firstRound.attackRating).toBe(64);
    expect(firstRound.defenseRating).toBe(50);
    expect(firstRound.weaponDamage).toBe(4);
    expect(firstRound.coreDamage).toBeCloseTo(13, 3);
    expect(firstRound.baseDamage).toBeCloseTo(17, 3);
    expect(firstRound.mitigation).toBeCloseTo(33 / 133, 3);
    expect(firstRound.damageAfterMitigation).toBeCloseTo(12.782, 2);
    expect(firstRound.damage).toBe(13);
    expect(firstRound.hit).toBe(true);
  });
});

describe('runTeamCombat orchestration', () => {
  const makeCombatant = (
    opts: Partial<Combatant> & { name: string; id: number },
  ): Combatant => ({
    id: opts.id,
    name: opts.name,
    type: (opts.type as any) || 'player',
    hp: opts.hp ?? 10,
    maxHp: opts.maxHp ?? 10,
    strength: opts.strength ?? 12,
    agility: opts.agility ?? 12,
    health: opts.health ?? 12,
    level: opts.level ?? 1,
    isAlive: opts.isAlive ?? true,
    damageRoll: opts.damageRoll,
  });

  test('party combat awards xp/gold and declares party winner', async () => {
    const party = [
      makeCombatant({ name: 'Fighter', id: 1, agility: 15, level: 2 }),
      makeCombatant({ name: 'Rogue', id: 2, agility: 14, level: 2 }),
    ];
    const monster = makeCombatant({
      name: 'Ogre',
      id: 99,
      type: 'monster',
      hp: 6,
      maxHp: 6,
      strength: 8,
      agility: 8,
      health: 12,
      level: 3,
    });

    const logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    const randomQueue = [0.2, 0.1, 0.01, 0.99];
    const overrides = {
      rollRandom: () => randomQueue.shift() ?? 0,
      rollDice: () => 5,
      calculateXpGain: () => 42,
      calculateGoldReward: () => 13,
    } as const;

    const result = await runTeamCombat(
      party,
      [monster],
      logger,
      overrides as any,
      { teamAName: 'Raid party' },
    );

    expect(result.winner).toBe('Raid party');
    expect(result.loser).toBe('Ogre');
    expect(result.xpAwarded).toBe(42);
    expect(result.goldAwarded).toBe(13);
    expect(result.initiativeRolls.length).toBe(3);
    expect(result.rounds.length).toBeGreaterThan(0);
  });
});
