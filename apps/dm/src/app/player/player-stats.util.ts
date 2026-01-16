import { Player } from '@mud/database';
import {
  calculateAttackRating,
  calculateBaseDamage,
  calculateCoreDamage,
  calculateDefenseRating,
  calculateMaxHp,
  calculateMitigation,
  effectiveStat,
  estimateWeaponDamage,
  type EffectiveStats,
} from '../combat/engine';
import type { EquipmentTotals } from './equipment.effects';

export type PlayerCombatSnapshot = {
  strength: number;
  agility: number;
  health: number;
  level: number;
  effectiveStrength: number;
  effectiveAgility: number;
  effectiveHealth: number;
  effectiveLevel: number;
  attackRating: number;
  defenseRating: number;
  baseDamage: number;
  mitigation: number;
  maxHp: number;
  weaponDamageRoll: string;
  gear: EquipmentTotals;
  statBonuses: { strength: number; agility: number; health: number };
};

const resolveStatBonuses = (
  gear: EquipmentTotals,
): { strength: number; agility: number; health: number } => {
  const strengthBonus = (gear.attackBonus ?? 0) + (gear.damageBonus ?? 0);
  const healthBonus = (gear.armorBonus ?? 0) + (gear.vitalityBonus ?? 0);
  return {
    strength: strengthBonus,
    agility: 0,
    health: healthBonus,
  };
};

/**
 * Compute combat stats for a player using the ratings-based combat math.
 */
export function computePlayerCombatStats(
  player: Player & { equipmentTotals?: EquipmentTotals },
): PlayerCombatSnapshot {
  const gear: EquipmentTotals = {
    attackBonus: player.equipmentTotals?.attackBonus ?? 0,
    damageBonus: player.equipmentTotals?.damageBonus ?? 0,
    armorBonus: player.equipmentTotals?.armorBonus ?? 0,
    vitalityBonus: player.equipmentTotals?.vitalityBonus ?? 0,
    weaponDamageRoll: player.equipmentTotals?.weaponDamageRoll ?? '1d4',
  };

  const statBonuses = resolveStatBonuses(gear);
  const strength = player.strength + statBonuses.strength;
  const agility = player.agility + statBonuses.agility;
  const health = player.health + statBonuses.health;
  const level = player.level;

  const effectiveStrength = effectiveStat(strength);
  const effectiveAgility = effectiveStat(agility);
  const effectiveHealth = effectiveStat(health);
  const effectiveLevel = effectiveStat(level);

  const effectiveStats: EffectiveStats = {
    strength: effectiveStrength,
    agility: effectiveAgility,
    health: effectiveHealth,
    level: effectiveLevel,
  };

  const attackRating = calculateAttackRating(effectiveStats);
  const defenseRating = calculateDefenseRating(effectiveStats);
  const coreDamage = calculateCoreDamage(effectiveStats);
  const weaponAverage = estimateWeaponDamage(gear.weaponDamageRoll ?? '1d4');
  const baseDamage = calculateBaseDamage(coreDamage, weaponAverage);
  const mitigation = calculateMitigation(effectiveStats);
  const maxHp = calculateMaxHp(health, level);

  return {
    strength,
    agility,
    health,
    level,
    effectiveStrength,
    effectiveAgility,
    effectiveHealth,
    effectiveLevel,
    attackRating,
    defenseRating,
    baseDamage,
    mitigation,
    maxHp,
    weaponDamageRoll: gear.weaponDamageRoll ?? '1d4',
    gear,
    statBonuses,
  };
}
