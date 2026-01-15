import { Logger } from '@nestjs/common';
import { EventBus } from '../../shared/event-bus';
import type { DetailedCombatLog, CombatRound, InitiativeRoll } from '../api';
import type { Combatant } from './types';

// Dice and combat math utilities
export function rollD20(): number {
  return Math.floor(Math.random() * 20) + 1;
}

export function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++)
    total += Math.floor(Math.random() * sides) + 1;
  return total;
}

export function getModifier(ability: number): number {
  return Math.floor((ability - 10) / 2);
}

export function calculateAC(agility: number): number {
  return 10 + getModifier(agility);
}

export function rollInitiative(agility: number): {
  roll: number;
  modifier: number;
  total: number;
} {
  const roll = rollD20();
  const modifier = getModifier(agility);
  return { roll, modifier, total: roll + modifier };
}

export function parseDice(dice: string): { count: number; sides: number } {
  const parts = dice.toLowerCase().split('d');
  if (parts.length !== 2) return { count: 1, sides: 4 };
  const count = parseInt(parts[0], 10);
  const sides = parseInt(parts[1], 10);
  if (isNaN(count) || isNaN(sides)) return { count: 1, sides: 4 };
  return { count, sides };
}

export function calculateDamage(strength: number, damageRoll = '1d4'): number {
  const { count, sides } = parseDice(damageRoll);
  const baseDamage = rollDice(count, sides);
  const modifier = getModifier(strength);
  return Math.max(1, baseDamage + modifier);
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

// Core combat runner (keeps much of the original logic but accepts a logger)
type EngineOverrides = Partial<{
  rollD20: () => number;
  rollDice: (count: number, sides: number) => number;
  getModifier: (ability: number) => number;
  calculateAC: (agility: number) => number;
  rollInitiative: (agility: number) => {
    roll: number;
    modifier: number;
    total: number;
  };
  calculateDamage: (strength: number, damageRoll?: string) => number;
  calculateXpGain: (winnerLevel: number, loserLevel: number) => number;
  calculateGoldReward: (victorLevel: number, targetLevel: number) => number;
}>;

export async function runCombat(
  combatant1: Combatant,
  combatant2: Combatant,
  logger: Logger,
  overrides?: EngineOverrides,
): Promise<DetailedCombatLog> {
  return runTeamCombat(
    [combatant1],
    [combatant2],
    logger,
    overrides,
    { teamAName: combatant1.name, teamBName: combatant2.name },
  );
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
  logger.log(
    `🗡️ COMBAT START: ${teamAName} vs ${teamBName} [ID: ${combatId}]`,
  );

  const useRollInitiative = overrides?.rollInitiative ?? rollInitiative;
  const useRollD20 = overrides?.rollD20 ?? rollD20;
  const useGetModifier = overrides?.getModifier ?? getModifier;
  const useCalculateAC = overrides?.calculateAC ?? calculateAC;
  const useCalculateDamage = overrides?.calculateDamage ?? calculateDamage;

  const combatants = [...teamA, ...teamB];
  const teamASet = new Set(teamA);
  const initiativeById = new Map<number, InitiativeRoll>();
  const orderIndex = new Map<number, number>();
  const initiativeRolls = combatants.map((combatant, index) => {
    const roll = useRollInitiative(combatant.agility);
    const entry = { name: combatant.name, ...roll };
    initiativeById.set(combatant.id, entry);
    orderIndex.set(combatant.id, index);
    return entry;
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

  const pickTarget = (team: Combatant[]) => {
    const alive = team.filter((combatant) => combatant.isAlive);
    if (alive.length === 0) return null;
    return alive.sort((a, b) => {
      if (a.hp !== b.hp) return a.hp - b.hp;
      const indexA = orderIndex.get(a.id) ?? 0;
      const indexB = orderIndex.get(b.id) ?? 0;
      return indexA - indexB;
    })[0];
  };

  const firstAttacker = firstCombatant?.name ?? teamAName;
  const firstDefender =
    firstCombatant
      ? pickTarget(resolveOpponents(firstCombatant)) ??
        resolveOpponents(firstCombatant)[0]
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

  while (
    teamAlive(teamA) &&
    teamAlive(teamB) &&
    roundNumber <= maxTurns
  ) {
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

    const defender = pickTarget(resolveOpponents(attacker));
    if (!defender) {
      break;
    }

    logger.debug(
      `⚔️ Turn ${roundNumber}: ${attacker.name} attacks ${defender.name}`,
    );

    const attackRoll = (overrides?.rollD20 ?? useRollD20)();
    const baseAttackModifier = (overrides?.getModifier ?? useGetModifier)(
      attacker.strength,
    );
    const attackModifier = baseAttackModifier + (attacker.attackBonus ?? 0);
    const totalAttack = attackRoll + attackModifier;
    const baseDefenderAC = (overrides?.calculateAC ?? useCalculateAC)(
      defender.agility,
    );
    const defenderAC = baseDefenderAC + (defender.armorBonus ?? 0);
    const hit = totalAttack >= defenderAC;

    logger.debug(
      `⚔️ Attack Roll: ${attackRoll} + Str mod: ${baseAttackModifier} + Equipment bonus: +${attacker.attackBonus ?? 0} = ${totalAttack} vs AC: ${baseDefenderAC} + Armor bonus: +${defender.armorBonus ?? 0} = ${defenderAC} [${hit ? 'HIT' : 'MISS'}]`,
    );

    let damage = 0;
    let killed = false;
    let baseDamage = 0;

    if (hit) {
      baseDamage = (overrides?.calculateDamage ?? useCalculateDamage)(
        attacker.strength,
        attacker.damageRoll,
      );
      const damageBonus = attacker.damageBonus ?? 0;
      damage = Math.max(1, baseDamage + damageBonus);
      logger.debug(
        `⚔️ ${attacker.name} hit! Base damage (${attacker.damageRoll ?? '1d4'}): ${baseDamage}, Weapon/Equipment bonus: +${damageBonus}, Total: ${damage}`,
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
      attackRoll,
      attackModifier,
      totalAttack,
      defenderAC,
      hit,
      damage,
      defenderHpAfter: defender.hp,
      killed,
      baseAttackModifier,
      attackBonus: attacker.attackBonus ?? 0,
      baseDefenderAC,
      armorBonus: defender.armorBonus ?? 0,
      baseDamage,
      damageBonus: attacker.damageBonus ?? 0,
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
