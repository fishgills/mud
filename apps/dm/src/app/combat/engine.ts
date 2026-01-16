import { Logger } from '@nestjs/common';
import { EventBus } from '../../shared/event-bus';
import type { DetailedCombatLog, CombatRound, InitiativeRoll } from '../api';
import type { Combatant } from './types';

export type EffectiveStats = {
  strength: number;
  agility: number;
  health: number;
  level: number;
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function effectiveStat(stat: number): number {
  return Math.sqrt(Math.max(0, stat));
}

export function toEffectiveStats(combatant: Combatant): EffectiveStats {
  return {
    strength: effectiveStat(combatant.strength),
    agility: effectiveStat(combatant.agility),
    health: effectiveStat(combatant.health),
    level: effectiveStat(combatant.level),
  };
}

export function calculateAttackRating(stats: EffectiveStats): number {
  return 10 * stats.strength + 4 * stats.agility + 6 * stats.level;
}

export function calculateDefenseRating(stats: EffectiveStats): number {
  return 10 * stats.agility + 2 * stats.health + 6 * stats.level;
}

export function calculateHitChance(
  attackRating: number,
  defenseRating: number,
): number {
  const x = (attackRating - defenseRating) / 15;
  const pRaw = 1 / (1 + Math.exp(-x));
  return clamp(pRaw, 0.1, 0.9);
}

export function calculateCoreDamage(stats: EffectiveStats): number {
  return 4 + 2 * stats.strength + 0.5 * stats.level;
}

export function calculateBaseDamage(
  coreDamage: number,
  weaponDamage: number,
): number {
  return coreDamage + weaponDamage;
}

export function calculateToughness(stats: EffectiveStats): number {
  return 6 * stats.health + 3 * stats.agility;
}

export function calculateMitigation(stats: EffectiveStats): number {
  const toughness = calculateToughness(stats);
  return toughness / (toughness + 100);
}

export function calculateCritChance(
  attacker: EffectiveStats,
  defender: EffectiveStats,
): number {
  return clamp(0.05 + (attacker.agility - defender.agility) / 100, 0.05, 0.25);
}

export function calculateMaxHp(health: number, level: number): number {
  const effectiveHealth = effectiveStat(health);
  const effectiveLevel = effectiveStat(level);
  return Math.max(1, Math.round(30 + 8 * effectiveHealth + 6 * effectiveLevel));
}

export function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++)
    total += Math.floor(Math.random() * sides) + 1;
  return total;
}

export function parseDice(dice: string): { count: number; sides: number } {
  const parts = dice.toLowerCase().split('d');
  if (parts.length !== 2) return { count: 1, sides: 4 };
  const count = parseInt(parts[0], 10);
  const sides = parseInt(parts[1], 10);
  if (isNaN(count) || isNaN(sides)) return { count: 1, sides: 4 };
  return { count, sides };
}

export function averageDiceRoll(count: number, sides: number): number {
  return (count * (sides + 1)) / 2;
}

export function estimateWeaponDamage(damageRoll?: string | null): number {
  const { count, sides } = parseDice(damageRoll ?? '1d4');
  return averageDiceRoll(count, sides);
}

export function rollWeaponDamage(
  damageRoll: string | null | undefined,
  rollDiceFn: (count: number, sides: number) => number = rollDice,
): number {
  const { count, sides } = parseDice(damageRoll ?? '1d4');
  return rollDiceFn(count, sides);
}

export function rollInitiative(
  agility: number,
  level: number,
  random: () => number = Math.random,
): { base: number; random: number; total: number } {
  const base = 1000 * effectiveStat(agility) + 10 * effectiveStat(level);
  const randomBonus = Math.floor(random() * 51);
  return { base, random: randomBonus, total: base + randomBonus };
}

export function calculateXpGain(
  winnerLevel: number,
  loserLevel: number,
): number {
  const base = 20 + 5 * Math.max(1, loserLevel);
  const variability = rollDice(2, 6) - 2;
  const levelDiff = loserLevel - winnerLevel;
  let multiplier: number;
  if (levelDiff >= 0) {
    multiplier = 1 + Math.min(2, levelDiff * 0.2);
  } else {
    multiplier = Math.max(0.25, 1 + levelDiff * 0.1);
  }
  const rawXp = (base + variability) * multiplier;
  return Math.max(5, Math.floor(rawXp));
}

export function calculateGoldReward(
  victorLevel: number,
  targetLevel: number,
): number {
  const baseGold = rollDice(5, 6);
  const levelDifference = targetLevel - victorLevel;
  const modifier = Math.max(0.5, 1 + levelDifference * 0.1);
  return Math.max(5, Math.floor(baseGold * modifier));
}

type InitiativeResult = { base: number; random: number; total: number };

// Core combat runner (ratings-based combat math)
type EngineOverrides = Partial<{
  rollRandom: () => number;
  rollDice: (count: number, sides: number) => number;
  rollInitiative: (agility: number, level: number) => InitiativeResult;
  calculateXpGain: (winnerLevel: number, loserLevel: number) => number;
  calculateGoldReward: (victorLevel: number, targetLevel: number) => number;
}>;

export async function runCombat(
  combatant1: Combatant,
  combatant2: Combatant,
  logger: Logger,
  overrides?: EngineOverrides,
): Promise<DetailedCombatLog> {
  return runTeamCombat([combatant1], [combatant2], logger, overrides, {
    teamAName: combatant1.name,
    teamBName: combatant2.name,
  });
}

type TeamCombatOptions = {
  teamAName?: string;
  teamBName?: string;
  maxTurns?: number;
};

export async function runTeamCombat(
  teamA: Combatant[],
  teamB: Combatant[],
  logger: Logger,
  overrides?: EngineOverrides,
  options: TeamCombatOptions = {},
): Promise<DetailedCombatLog> {
  if (teamA.length === 0 || teamB.length === 0) {
    throw new Error('Team combat requires at least one combatant per side.');
  }

  const teamAName =
    options.teamAName ?? (teamA.length === 1 ? teamA[0].name : 'Team A');
  const teamBName =
    options.teamBName ?? (teamB.length === 1 ? teamB[0].name : 'Team B');

  const combatId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.log(`🗡️ COMBAT START: ${teamAName} vs ${teamBName} [ID: ${combatId}]`);

  const useRollRandom = overrides?.rollRandom ?? Math.random;
  const useRollDice = overrides?.rollDice ?? rollDice;

  const combatants = [...teamA, ...teamB];
  const teamASet = new Set(teamA);
  const initiativeById = new Map<number, InitiativeResult>();
  const effectiveStatsById = new Map<number, EffectiveStats>();
  const orderIndex = new Map<number, number>();

  for (const [index, combatant] of combatants.entries()) {
    orderIndex.set(combatant.id, index);
    effectiveStatsById.set(combatant.id, toEffectiveStats(combatant));
  }

  const initiativeRolls: InitiativeRoll[] = combatants.map((combatant) => {
    const result = overrides?.rollInitiative
      ? overrides.rollInitiative(combatant.agility, combatant.level)
      : rollInitiative(combatant.agility, combatant.level, useRollRandom);
    initiativeById.set(combatant.id, result);
    return { name: combatant.name, ...result };
  });

  const turnOrder = [...combatants].sort((a, b) => {
    const initA = initiativeById.get(a.id)?.total ?? 0;
    const initB = initiativeById.get(b.id)?.total ?? 0;
    if (initA !== initB) return initB - initA;
    if (a.agility !== b.agility) return b.agility - a.agility;
    const indexA = orderIndex.get(a.id) ?? 0;
    const indexB = orderIndex.get(b.id) ?? 0;
    return indexA - indexB;
  });

  const firstCombatant = turnOrder[0];
  const resolveOpponents = (combatant: Combatant) =>
    teamASet.has(combatant) ? teamB : teamA;

  const pickTarget = (attacker: Combatant, team: Combatant[]) => {
    const alive = team.filter((combatant) => combatant.isAlive);
    if (alive.length === 0) return null;

    if (attacker.type === 'monster' && alive.length > 1) {
      const threatTarget = (() => {
        let best = alive[0];
        let bestScore = -Infinity;
        for (const combatant of alive) {
          const stats = effectiveStatsById.get(combatant.id);
          if (!stats) continue;
          const attackRating = calculateAttackRating(stats);
          const coreDamage = calculateCoreDamage(stats);
          const weaponAverage = estimateWeaponDamage(
            combatant.damageRoll ?? '1d4',
          );
          const baseDamage = calculateBaseDamage(coreDamage, weaponAverage);
          const score = attackRating + baseDamage;
          if (score > bestScore) {
            best = combatant;
            bestScore = score;
            continue;
          }
          if (score === bestScore) {
            const indexBest = orderIndex.get(best.id) ?? 0;
            const indexCandidate = orderIndex.get(combatant.id) ?? 0;
            if (indexCandidate < indexBest) {
              best = combatant;
              bestScore = score;
            }
          }
        }
        return best;
      })();

      if (useRollRandom() < 0.8) {
        return threatTarget;
      }

      const targetIndex = Math.floor(useRollRandom() * alive.length);
      return alive[targetIndex] ?? threatTarget;
    }

    return alive.sort((a, b) => {
      if (a.hp !== b.hp) return a.hp - b.hp;
      const indexA = orderIndex.get(a.id) ?? 0;
      const indexB = orderIndex.get(b.id) ?? 0;
      return indexA - indexB;
    })[0];
  };

  const firstAttacker = firstCombatant?.name ?? teamAName;
  const firstDefender = firstCombatant
    ? (pickTarget(firstCombatant, resolveOpponents(firstCombatant)) ??
      resolveOpponents(firstCombatant)[0])
    : teamB[0];

  await EventBus.emit({
    eventType: 'combat:start',
    attacker: {
      type: firstCombatant?.type ?? 'player',
      id: firstCombatant?.id ?? teamA[0].id,
      name: firstAttacker,
    },
    defender: {
      type: firstDefender.type,
      id: firstDefender.id,
      name: firstDefender.name,
    },
    timestamp: new Date(),
  });

  logger.log(
    `⚡ Initiative Results: ${initiativeRolls
      .map((entry) => `${entry.name}=${entry.total}`)
      .join(', ')} | ${firstAttacker} goes first!`,
  );

  const rounds: CombatRound[] = [];
  let turnIndex = 0;
  let roundNumber = 1;
  const maxTurns = options.maxTurns ?? 100;

  const teamAlive = (team: Combatant[]) =>
    team.some((combatant) => combatant.isAlive);

  while (teamAlive(teamA) && teamAlive(teamB) && roundNumber <= maxTurns) {
    let attacker = turnOrder[turnIndex % turnOrder.length];
    let spins = 0;
    while (attacker && !attacker.isAlive && spins < turnOrder.length) {
      turnIndex++;
      attacker = turnOrder[turnIndex % turnOrder.length];
      spins++;
    }

    if (!attacker || !attacker.isAlive) {
      break;
    }

    const defender = pickTarget(attacker, resolveOpponents(attacker));
    if (!defender) {
      break;
    }

    const attackerStats = effectiveStatsById.get(attacker.id);
    const defenderStats = effectiveStatsById.get(defender.id);
    if (!attackerStats || !defenderStats) {
      break;
    }

    logger.debug(
      `⚔️ Turn ${roundNumber}: ${attacker.name} attacks ${defender.name}`,
    );

    const attackRating = calculateAttackRating(attackerStats);
    const defenseRating = calculateDefenseRating(defenderStats);
    const hitChance = calculateHitChance(attackRating, defenseRating);
    const hitRoll = useRollRandom();
    const hit = hitRoll < hitChance;

    logger.debug(
      `⚔️ Ratings: AR ${attackRating.toFixed(2)} vs DR ${defenseRating.toFixed(2)} => hit ${(hitChance * 100).toFixed(1)}% (roll ${(hitRoll * 100).toFixed(1)}%) [${hit ? 'HIT' : 'MISS'}]`,
    );

    let weaponDamage = 0;
    let coreDamage = 0;
    let baseDamage = 0;
    let mitigation = calculateMitigation(defenderStats);
    let damageAfterMitigation = 0;
    let critChance: number | undefined;
    let critRoll: number | undefined;
    let crit = false;
    let critMultiplier: number | undefined;
    let damage = 0;
    let killed = false;

    if (hit) {
      weaponDamage = rollWeaponDamage(attacker.damageRoll, useRollDice);
      coreDamage = calculateCoreDamage(attackerStats);
      baseDamage = calculateBaseDamage(coreDamage, weaponDamage);
      damageAfterMitigation = baseDamage * (1 - mitigation);
      critChance = calculateCritChance(attackerStats, defenderStats);
      critRoll = useRollRandom();
      critMultiplier = 1.5;
      crit = critRoll < critChance;
      const critDamage = crit
        ? damageAfterMitigation * critMultiplier
        : damageAfterMitigation;
      damage = Math.max(1, Math.round(critDamage));
      logger.debug(
        `⚔️ Damage: core ${coreDamage.toFixed(2)} + weapon ${weaponDamage} = ${baseDamage.toFixed(2)} -> mitigated ${damageAfterMitigation.toFixed(2)} (${(mitigation * 100).toFixed(1)}% mit)${crit ? ' CRIT' : ''} => ${damage}`,
      );
      defender.hp = Math.max(0, defender.hp - damage);
      if (defender.hp <= 0) {
        defender.isAlive = false;
        killed = true;
        logger.log(`💀 ${defender.name} is defeated!`);
      }
    }

    rounds.push({
      roundNumber,
      attackerName: attacker.name,
      defenderName: defender.name,
      attackerEffectiveStats: attackerStats,
      defenderEffectiveStats: defenderStats,
      attackRating,
      defenseRating,
      hitChance,
      hitRoll,
      hit,
      weaponDamage,
      weaponDamageRoll: attacker.damageRoll ?? '1d4',
      coreDamage,
      baseDamage,
      mitigation,
      damageAfterMitigation,
      critChance,
      critRoll,
      critMultiplier,
      crit,
      damage,
      defenderHpAfter: defender.hp,
      killed,
    });

    if (hit) {
      await EventBus.emit({
        eventType: 'combat:hit',
        attacker: { type: attacker.type, id: attacker.id, name: attacker.name },
        defender: { type: defender.type, id: defender.id, name: defender.name },
        damage,
        timestamp: new Date(),
      });
    } else {
      await EventBus.emit({
        eventType: 'combat:miss',
        attacker: { type: attacker.type, id: attacker.id, name: attacker.name },
        defender: { type: defender.type, id: defender.id, name: defender.name },
        timestamp: new Date(),
      });
    }

    turnIndex++;
    roundNumber++;
  }

  logger.log(`🏁 Combat completed after ${roundNumber - 1} turns`);

  const teamAAlive = teamAlive(teamA);
  const teamBAlive = teamAlive(teamB);
  const teamAWon = teamAAlive && !teamBAlive;
  const teamBWon = teamBAlive && !teamAAlive;
  const winnerName = teamAWon ? teamAName : teamBWon ? teamBName : teamAName;
  const loserName = teamAWon ? teamBName : teamBWon ? teamAName : teamBName;
  const winnerTeam = teamAWon ? teamA : teamBWon ? teamB : teamA;
  const loserTeam = teamAWon ? teamB : teamBWon ? teamA : teamB;

  const averageLevel = (team: Combatant[]) =>
    Math.max(
      1,
      Math.round(
        team.reduce((sum, combatant) => sum + combatant.level, 0) / team.length,
      ),
    );

  const xpAwarded = (overrides?.calculateXpGain ?? calculateXpGain)(
    averageLevel(winnerTeam),
    averageLevel(loserTeam),
  );
  const goldAwarded = (overrides?.calculateGoldReward ?? calculateGoldReward)(
    averageLevel(winnerTeam),
    averageLevel(loserTeam),
  );

  const winnerCombatant =
    winnerTeam.find((combatant) => combatant.isAlive) ?? winnerTeam[0];
  const loserCombatant =
    loserTeam.find((combatant) => combatant.isAlive) ?? loserTeam[0];

  const winnerSuffix =
    winnerTeam.length === 1 ? ` (${winnerCombatant.hp} HP remaining)` : '';
  const loserSuffix =
    loserTeam.length === 1 ? ` (${loserCombatant.hp} HP remaining)` : '';

  logger.log(`🏆 Winner: ${winnerName}${winnerSuffix}`);
  logger.log(`💀 Loser: ${loserName}${loserSuffix}`);

  const combatLog: DetailedCombatLog = {
    combatId,
    participant1: teamAName,
    participant2: teamBName,
    initiativeRolls,
    firstAttacker,
    rounds,
    winner: winnerName,
    loser: loserName,
    xpAwarded,
    goldAwarded,
    timestamp: new Date(),
  } as DetailedCombatLog;

  logger.log(
    `💾 Combat log created with ${rounds.length} individual attacks and ${rounds.reduce((sum, r) => sum + r.damage, 0)} total damage`,
  );

  await EventBus.emit({
    eventType: 'combat:end',
    winner: {
      type: winnerCombatant.type,
      id: winnerCombatant.id,
      name: winnerCombatant.name,
    },
    loser: {
      type: loserCombatant.type,
      id: loserCombatant.id,
      name: loserCombatant.name,
    },
    xpGained: xpAwarded,
    goldGained: goldAwarded,
    timestamp: new Date(),
  });

  return combatLog;
}
