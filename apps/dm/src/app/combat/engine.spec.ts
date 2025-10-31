import * as engine from './engine';
import { runCombat } from './engine';
import type { Combatant } from './types';

describe('combat engine utilities', () => {
  test('getModifier and calculateAC produce expected values', () => {
    expect(engine.getModifier(16)).toBe(3);
    expect(engine.getModifier(10)).toBe(0);
    expect(engine.getModifier(9)).toBe(-1);
    expect(engine.calculateAC(14)).toBe(12); // 10 + modifier(14)=+2
  });

  test('calculateXpGain and calculateGoldReward are deterministic when Math.random is mocked', () => {
    // Mock Math.random sequence for rollDice used by calculateXpGain
    // rollDice(2,6) will call Math.random twice. We want a sum of 7 -> use 0 (->1) and ~1 (->6)
    const mr = jest.spyOn(Math, 'random');
    mr.mockReturnValueOnce(0).mockReturnValueOnce(0.9999);
    const xp = engine.calculateXpGain(3, 4);
    // base = 20 + 5*4 = 40, variability = (1+6)-2 = 5, levelDiff = 1 -> multiplier 1.2
    // raw = (40+5) * 1.2 = 54 -> floor 54
    expect(xp).toBe(54);

    // Now mock five Math.random calls for calculateGoldReward to yield baseGold=20
    // Use 0.5 for each -> floor(0.5*6)+1 = 4 -> 4*5 = 20
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
    level: opts.level ?? 1,
    isAlive: opts.isAlive ?? true,
    x: opts.x ?? 0,
    y: opts.y ?? 0,
    slackId: opts.slackId,
  });

  test('attacker wins and xp/gold from overrides are applied to returned log', async () => {
    const attacker = makeCombatant({
      name: 'Hero',
      id: 1,
      hp: 12,
      strength: 14,
      agility: 20,
      level: 3,
      slackId: 'S1',
    });
    const defender = makeCombatant({
      name: 'Goblin',
      id: 2,
      hp: 3,
      strength: 8,
      agility: 5,
      level: 2,
      slackId: 'S2',
    });

    const logger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    const overrides = {
      rollInitiative: (agility: number) =>
        agility > 10
          ? { roll: 19, modifier: 5, total: 24 }
          : { roll: 1, modifier: -5, total: -4 },
      rollD20: () => 15,
      calculateDamage: () => 5,
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
});
