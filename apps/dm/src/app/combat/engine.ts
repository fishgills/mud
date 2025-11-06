import { Logger } from '@nestjs/common';
import { EventBus } from '@mud/engine';
import type { DetailedCombatLog, CombatRound } from '../api';
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

export function calculateDamage(strength: number): number {
  const baseDamage = Math.floor(Math.random() * 6) + 1;
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
  calculateDamage: (strength: number) => number;
  calculateXpGain: (winnerLevel: number, loserLevel: number) => number;
  calculateGoldReward: (victorLevel: number, targetLevel: number) => number;
}>;

export async function runCombat(
  combatant1: Combatant,
  combatant2: Combatant,
  logger: Logger,
  overrides?: EngineOverrides,
): Promise<DetailedCombatLog> {
  const combatId = `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  logger.log(
    `🗡️ COMBAT START: ${combatant1.name} vs ${combatant2.name} [ID: ${combatId}]`,
  );

  await EventBus.emit({
    eventType: 'combat:start',
    attacker: {
      type: combatant1.type,
      id: combatant1.id,
      name: combatant1.name,
    },
    defender: {
      type: combatant2.type,
      id: combatant2.id,
      name: combatant2.name,
    },
    x: combatant1.x,
    y: combatant1.y,
    timestamp: new Date(),
  });

  const useRollInitiative = overrides?.rollInitiative ?? rollInitiative;
  const useRollD20 = overrides?.rollD20 ?? rollD20;
  const useGetModifier = overrides?.getModifier ?? getModifier;
  const useCalculateAC = overrides?.calculateAC ?? calculateAC;
  const useCalculateDamage = overrides?.calculateDamage ?? calculateDamage;

  const init1 = useRollInitiative(combatant1.agility);
  const init2 = useRollInitiative(combatant2.agility);

  const initiativeRolls = [
    { name: combatant1.name, ...init1 },
    { name: combatant2.name, ...init2 },
  ];
  let attacker = init1.total >= init2.total ? combatant1 : combatant2;
  let defender = init1.total >= init2.total ? combatant2 : combatant1;
  const firstAttacker = attacker.name;

  logger.log(
    `⚡ Initiative Results: ${combatant1.name}=${init1.total}, ${combatant2.name}=${init2.total} | ${firstAttacker} goes first!`,
  );

  const rounds: CombatRound[] = [];
  let roundNumber = 1;

  while (attacker.isAlive && defender.isAlive && roundNumber <= 100) {
    logger.debug(
      `⚔️ Round ${roundNumber}: ${attacker.name} attacks ${defender.name}`,
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

    if (hit) {
      const baseDamage = (overrides?.calculateDamage ?? useCalculateDamage)(
        attacker.strength,
      );
      const damageBonus = attacker.damageBonus ?? 0;
      damage = Math.max(1, baseDamage + damageBonus);
      logger.debug(
        `⚔️ ${attacker.name} hit! Base damage: ${baseDamage}, Weapon/Equipment bonus: +${damageBonus}, Total: ${damage}`,
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
    });

    if (hit) {
      await EventBus.emit({
        eventType: 'combat:hit',
        attacker: { type: attacker.type, id: attacker.id, name: attacker.name },
        defender: { type: defender.type, id: defender.id, name: defender.name },
        damage,
        x: attacker.x,
        y: attacker.y,
        timestamp: new Date(),
      });
    } else {
      await EventBus.emit({
        eventType: 'combat:miss',
        attacker: { type: attacker.type, id: attacker.id, name: attacker.name },
        defender: { type: defender.type, id: defender.id, name: defender.name },
        x: attacker.x,
        y: attacker.y,
        timestamp: new Date(),
      });
    }

    if (killed) break;

    [attacker, defender] = [defender, attacker];
    logger.debug(`Turn switch: Next attacker is ${attacker.name}`);
    roundNumber++;
  }

  logger.log(
    `🏁 Combat completed after ${Math.ceil((roundNumber - 1) / 2)} full rounds`,
  );

  const winner = combatant1.isAlive ? combatant1 : combatant2;
  const loser = combatant1.isAlive ? combatant2 : combatant1;
  const xpAwarded = (overrides?.calculateXpGain ?? calculateXpGain)(
    winner.level,
    loser.level,
  );
  const goldAwarded = (overrides?.calculateGoldReward ?? calculateGoldReward)(
    winner.level,
    loser.level,
  );

  logger.log(`🏆 Winner: ${winner.name} (${winner.hp} HP remaining)`);
  logger.log(`💀 Loser: ${loser.name} (${loser.hp} HP remaining)`);

  const combatLog: DetailedCombatLog = {
    combatId,
    participant1: combatant1.name,
    participant2: combatant2.name,
    initiativeRolls,
    firstAttacker,
    rounds,
    winner: winner.name,
    loser: loser.name,
    xpAwarded,
    goldAwarded,
    timestamp: new Date(),
    location: { x: combatant1.x, y: combatant1.y },
  } as DetailedCombatLog;

  logger.log(
    `💾 Combat log created with ${rounds.length} individual attacks and ${rounds.reduce((sum, r) => sum + r.damage, 0)} total damage`,
  );

  await EventBus.emit({
    eventType: 'combat:end',
    winner: { type: winner.type, id: winner.id, name: winner.name },
    loser: { type: loser.type, id: loser.id, name: loser.name },
    xpGained: xpAwarded,
    goldGained: goldAwarded,
    x: combatLog.location.x,
    y: combatLog.location.y,
    timestamp: new Date(),
  });

  return combatLog;
}
